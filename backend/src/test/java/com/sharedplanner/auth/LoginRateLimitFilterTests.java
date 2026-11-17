package com.sharedplanner.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;

class LoginRateLimitFilterTests {
    @Test void authenticationRecordsCannotLeakCredentialsInDiagnosticLogging() {
        assertThat(new LoginRequest("synthetic@example.invalid","synthetic-secret").toString())
                .doesNotContain("synthetic@example.invalid","synthetic-secret");
        assertThat(new LoginResponse("synthetic-token","Bearer").toString()).doesNotContain("synthetic-token");
    }
    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-17T12:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
    private MockHttpServletResponse call(LoginRateLimitFilter filter, String ip, String path) throws Exception {
        var request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path); request.setRemoteAddr(ip);
        request.addHeader("X-Forwarded-For", "untrusted-" + System.nanoTime());
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req,res) -> ((jakarta.servlet.http.HttpServletResponse)res).setStatus(204));
        return response;
    }
    @Test void expiresWithoutBlockingOtherClientsOrEndpointsAndIgnoresForwardedHeaders() throws Exception {
        var clock = new TestClock(); var filter = new LoginRateLimitFilter(2,60,clock);
        assertThat(call(filter,"127.0.0.1","/api/auth/login").getStatus()).isEqualTo(204);
        assertThat(call(filter,"127.0.0.1","/api/auth/login").getStatus()).isEqualTo(204);
        var denied=call(filter,"127.0.0.1","/api/auth/login");
        assertThat(denied.getStatus()).isEqualTo(429);
        assertThat(denied.getHeader("Retry-After")).isEqualTo("60");
        assertThat(call(filter,"127.0.0.2","/api/auth/login").getStatus()).isEqualTo(204);
        assertThat(call(filter,"127.0.0.1","/api/events").getStatus()).isEqualTo(204);
        clock.now=clock.now.plusSeconds(60);
        assertThat(call(filter,"127.0.0.1","/api/auth/login").getStatus()).isEqualTo(204);
    }
    @Test void concurrentAttemptsCannotExceedTheConfiguredBudget() throws Exception {
        var filter=new LoginRateLimitFilter(3,60,new TestClock());
        var pool=Executors.newFixedThreadPool(8); var ready=new CountDownLatch(8); var start=new CountDownLatch(1);
        var admitted=new AtomicInteger(); var denied=new AtomicInteger();
        try {
            var futures=new java.util.ArrayList<Future<?>>();
            for(int i=0;i<8;i++) futures.add(pool.submit(() -> {
                ready.countDown(); start.await();
                int status=call(filter,"127.0.0.1","/api/auth/login").getStatus();
                if(status==204)admitted.incrementAndGet(); else if(status==429)denied.incrementAndGet();
                return null;
            }));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue(); start.countDown();
            for(var future:futures)future.get(10,TimeUnit.SECONDS);
            assertThat(admitted.get()).isEqualTo(3); assertThat(denied.get()).isEqualTo(5);
        } finally { pool.shutdownNow(); }
    }
}

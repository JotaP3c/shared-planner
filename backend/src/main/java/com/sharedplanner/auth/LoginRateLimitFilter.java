package com.sharedplanner.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/** Bounded, per-process login throttle. Proxy-supplied IP headers are never trusted. */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private record Window(long expiresAt, int attempts, boolean reported) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final int attempts;
    private final long windowMillis;
    private final Clock clock;
    private static final int MAX_CLIENTS = 10_000;

    @Autowired
    public LoginRateLimitFilter(
            @Value("${app.login-rate-limit.attempts:10}") int attempts,
            @Value("${app.login-rate-limit.window-seconds:60}") long seconds) {
        this(attempts, seconds, Clock.systemUTC());
    }

    LoginRateLimitFilter(int attempts, long seconds, Clock clock) {
        if (attempts < 1 || seconds < 1 || seconds > 86400) throw new IllegalArgumentException("Invalid login throttle configuration");
        this.attempts = attempts;
        this.windowMillis = seconds * 1000;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath().isEmpty() ? request.getRequestURI() : request.getServletPath();
        return !"POST".equals(request.getMethod()) || !"/api/auth/login".equals(path);
    }

    private synchronized long retryAfter(String address) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().expiresAt <= now);
        Window window = windows.get(address);
        if (window == null) {
            if (windows.size() >= MAX_CLIENTS) return 1;
            windows.put(address, new Window(now + windowMillis, 1, false));
            return 0;
        }
        if (window.attempts >= attempts) {
            if(!window.reported) {
                logger.warn("security_event=login_rate_limit");
                windows.put(address,new Window(window.expiresAt,window.attempts,true));
            }
            return Math.max(1, (window.expiresAt - now + 999) / 1000);
        }
        windows.put(address, new Window(window.expiresAt, window.attempts + 1, false));
        return 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long retry = retryAfter(request.getRemoteAddr());
        if (retry == 0) { chain.doFilter(request, response); return; }
        response.setStatus(429);
        response.setHeader("Retry-After", Long.toString(retry));
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Too many login attempts. Try again later.\"}");
    }
}

package com.sharedplanner.stabilization;

import com.jayway.jsonpath.JsonPath;
import com.sharedplanner.calendar.CalendarService;
import com.sharedplanner.event.EventRepository;
import com.sharedplanner.user.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Real HTTP, Flyway and PostgreSQL; refuses every database except the private test target. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties={"spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate",
                "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.show-sql=false",
                "logging.level.org.hibernate.SQL=WARN", "logging.level.org.springframework=WARN",
                "logging.level.org.springframework.web=WARN", "logging.level.org.springframework.jdbc=WARN",
                "app.login-rate-limit.attempts=100"})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="PLANNER_PHASE3_TEST_URL",matches=".+")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Phase3PostgresIntegrationTests {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        String url=System.getenv("PLANNER_PHASE3_TEST_URL");
        if(!"jdbc:postgresql://127.0.0.1:54629/phase3_stabilization_test".equals(url))
            throw new IllegalStateException("Only the isolated phase3 database is permitted");
        PostgresTestBackup.create("phase3_stabilization_test",null);
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->"planner_test");
        registry.add("spring.datasource.password",()->"");
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired CalendarService calendars;
    @Autowired EventRepository events;
    @Autowired PlatformTransactionManager transactions;
    final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    User admin,owner,approver,outsider;
    String ownerToken,adminToken,approverToken,outsiderToken,calendar;
    static final String PASSWORD="Synthetic-phase3-only";

    @BeforeEach void seedIsolatedData() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("phase3_stabilization_test");
        // This entire database is disposable and has a verified pre-migration backup.
        jdbc.execute("TRUNCATE users CASCADE");
        admin=user("admin",UserRole.ADMIN); owner=user("owner",UserRole.FINANCE);
        approver=user("approver",UserRole.FINANCE); outsider=user("outsider",UserRole.USER);
        adminToken=login(admin); ownerToken=login(owner); approverToken=login(approver); outsiderToken=login(outsider);
        var response=request("GET","/api/calendars",ownerToken,null);
        assertThat(response.statusCode()).isEqualTo(200);
        calendar=read(response,"$[0].id");
    }
    User user(String name,UserRole role) {
        User user=users.saveAndFlush(new User(name,name+"@phase3.invalid",passwords.encode(PASSWORD),role,null));
        calendars.provisionPersonalCalendar(user); return user;
    }
    String login(User user) throws Exception {
        var response=request("POST","/api/auth/login",null,"{\"email\":\""+user.getEmail()+"\",\"password\":\""+PASSWORD+"\"}");
        assertThat(response.statusCode()).isEqualTo(200); return read(response,"$.accessToken");
    }
    HttpResponse<byte[]> request(String method,String path,String token,String body) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(20));
        if(token!=null)builder.header("Authorization","Bearer "+token);
        if(body!=null)builder.header("Content-Type","application/json");
        return client.send(builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofByteArray());
    }
    <T> T read(HttpResponse<byte[]> response,String path) {
        return JsonPath.read(new String(response.body(),StandardCharsets.UTF_8),path);
    }
    String clientBody(String amount) {
        return "{\"calendarId\":\""+calendar+"\",\"eventType\":\"CLIENT\",\"title\":\"Synthetic appointment\",\"clientName\":\"Synthetic client\",\"workDescription\":\"Synthetic service\",\"amount\":"+amount+",\"startsAt\":\"2030-11-17T10:00:00\",\"endsAt\":\"2030-11-17T11:00:00\"}";
    }
    String createClient() throws Exception {
        var response=request("POST","/api/events",ownerToken,clientBody("100"));
        assertThat(response.statusCode()).isEqualTo(201); return read(response,"$.id");
    }
    String payment(String status,int amount) {
        return "{\"paymentStatus\":\""+status+"\",\"receivedAmount\":"+amount+",\"paymentMethod\":\"PIX\"}";
    }
    String financePath(String endpoint) {
        return "/api/finance/"+endpoint+"?"+(endpoint.equals("export")?"calendarIds=":"calendarId=")+calendar+"&startDate=2030-11-01&endDate=2030-11-30";
    }
    @Test @Order(1) void realLoginClientConfirmationPaymentFinanceAndNativeExcelJourney() throws Exception {
        String id=createClient();
        assertThat(request("POST","/api/events/"+id+"/confirm",ownerToken,null).statusCode()).isEqualTo(200);
        assertThat(request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PARTIALLY_PAID",40)).statusCode()).isEqualTo(200);
        var summary=request("GET",financePath("summary"),ownerToken,null);
        assertThat(summary.statusCode()).isEqualTo(200);
        assertThat(((Number)read(summary,"$.expectedAmount")).intValue()).isEqualTo(100);
        assertThat(((Number)read(summary,"$.receivedAmount")).intValue()).isEqualTo(40);
        assertThat(((Number)read(summary,"$.pendingAmount")).intValue()).isEqualTo(60);
        var export=request("GET",financePath("export"),ownerToken,null);
        assertThat(export.statusCode()).isEqualTo(200);
        try(var workbook=new XSSFWorkbook(new ByteArrayInputStream(export.body()))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(4);
            assertThat(workbook.getAllEmbeddedParts()).isEmpty();
            var dashboard=workbook.getSheet("Dashboard");
            assertThat(dashboard.getRow(6).getCell(0).getNumericCellValue()).isEqualTo(100);
            assertThat(dashboard.getRow(6).getCell(1).getNumericCellValue()).isEqualTo(40);
            assertThat(dashboard.getRow(6).getCell(2).getNumericCellValue()).isEqualTo(60);
            assertThat(dashboard.getDrawingPatriarch().getCharts()).hasSize(3);
        }
        assertThat(request("GET",financePath("summary"),outsiderToken,null).statusCode()).isIn(403,404);
        assertThat(request("GET",financePath("export"),outsiderToken,null).statusCode()).isIn(403,404);
        assertThat(request("PUT","/api/events/"+id+"/payment",outsiderToken,payment("PAID",100)).statusCode()).isIn(403,404);
    }
    @Test @Order(1) void authenticationAndCrossResourceAccessStayDeniedOverRealHttp() throws Exception {
        String id=createClient();
        assertThat(request("GET","/api/calendars",null,null).statusCode()).isEqualTo(401);
        assertThat(request("GET","/api/calendars",ownerToken+"tampered",null).statusCode()).isEqualTo(401);
        assertThat(request("POST","/api/auth/login",null,"{\"email\":\"owner@phase3.invalid\",\"password\":\"wrong-test-password\"}").statusCode()).isEqualTo(401);
        assertThat(request("GET","/api/users",outsiderToken,null).statusCode()).isEqualTo(403);
        assertThat(request("GET","/api/audit-logs?calendarId="+calendar,outsiderToken,null).statusCode()).isIn(403,404);
        var denied=request("GET","/api/events/"+id,outsiderToken,null);
        assertThat(denied.statusCode()).isIn(403,404);
        assertThat(new String(denied.body(),StandardCharsets.UTF_8)).doesNotContain("receivedAmount","clientName","Synthetic service");
        assertThat(request("DELETE","/api/events/"+id,outsiderToken,null).statusCode()).isIn(403,404);
        assertThat(jdbc.queryForObject("select status from events where id=?",String.class,UUID.fromString(id))).isNotEqualTo("CANCELLED");
    }
    @Test @Order(1) void databaseRejectsInconsistentPaymentsAndPreservesRefundsAndCancellations() throws Exception {
        String id=createClient();
        for(String invalid:List.of("received_amount=101","payment_status='PARTIALLY_PAID',received_amount=0",
                "payment_status='PAID',received_amount=100", "event_type='PERSONAL',received_amount=10")) {
            assertThatThrownBy(()->jdbc.update("UPDATE events SET "+invalid+" WHERE id=?",UUID.fromString(id)))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
        assertThat(request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PARTIALLY_PAID",40)).statusCode()).isEqualTo(200);
        assertThat(request("PUT","/api/events/"+id,ownerToken,clientBody("50")).statusCode()).isEqualTo(400);
        assertThat(request("PUT","/api/events/"+id+"/payment",ownerToken,payment("REFUNDED",0)).statusCode()).isEqualTo(200);
        assertThat(request("PUT","/api/events/"+id,ownerToken,clientBody("50")).statusCode()).isEqualTo(400);
        assertThat(request("DELETE","/api/events/"+id,ownerToken,null).statusCode()).isEqualTo(204);
        assertThat(request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode()).isEqualTo(400);
        assertThat(jdbc.queryForObject("select payment_status from events where id=?",String.class,UUID.fromString(id))).isEqualTo("REFUNDED");
        assertThat(jdbc.queryForObject("select received_amount from events where id=?",BigDecimal.class,UUID.fromString(id))).isEqualByComparingTo("0");
    }
    List<Integer> race(Callable<Integer> first,Callable<Integer> second) throws Exception {
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1); var ready=new CountDownLatch(2);
        try {
            var a=pool.submit(()->{ready.countDown();start.await();return first.call();});
            var b=pool.submit(()->{ready.countDown();start.await();return second.call();});
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();
            return List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); }
    }
    @Test @Order(1) void paymentAndAmountChangeAreSerializedByPostgres() throws Exception {
        String id=createClient();
        var outcomes=race(()->request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode(),
                ()->request("PUT","/api/events/"+id,ownerToken,clientBody("50")).statusCode());
        assertThat(outcomes).containsExactlyInAnyOrder(200,400);
        var amount=jdbc.queryForObject("select amount from events where id=?",BigDecimal.class,UUID.fromString(id));
        var received=jdbc.queryForObject("select received_amount from events where id=?",BigDecimal.class,UUID.fromString(id));
        assertThat(received).isLessThanOrEqualTo(amount);
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_id=?",Integer.class,UUID.fromString(id))).isEqualTo(2);
    }
    @Test @Order(1) void cancelAndPayCannotCommitAnInvalidState() throws Exception {
        String id=createClient();
        var outcomes=race(()->request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode(),
                ()->request("DELETE","/api/events/"+id,ownerToken,null).statusCode());
        assertThat(outcomes.get(1)).isEqualTo(204);
        assertThat(outcomes.get(0)).isIn(200,400);
        assertThat(jdbc.queryForObject("select status from events where id=?",String.class,UUID.fromString(id))).isEqualTo("CANCELLED");
        assertThat(request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode()).isEqualTo(400);
        assertThat(jdbc.queryForObject("select received_amount from events where id=?",BigDecimal.class,UUID.fromString(id)))
                .isEqualByComparingTo(outcomes.get(0)==200 ? "100" : "0");
    }
    @Test @Order(1) void concurrentOwnerMutationCannotRemoveOrDemoteTheOwner() throws Exception {
        String member=jdbc.queryForObject("select id::text from calendar_members where calendar_id=? and user_id=?",String.class,UUID.fromString(calendar),owner.getId());
        var outcomes=race(()->request("PUT","/api/calendars/"+calendar+"/members/"+member,ownerToken,"{\"role\":\"VIEWER\"}").statusCode(),
                ()->request("DELETE","/api/calendars/"+calendar+"/members/"+member,ownerToken,null).statusCode());
        assertThat(outcomes).containsExactly(400,400);
        assertThat(jdbc.queryForObject("select member_role from calendar_members where id=?",String.class,UUID.fromString(member))).isEqualTo("ADMIN");
    }
    @Test @Order(1) void simultaneousPaymentSnapshotsAreSerializedAndBothAreAudited() throws Exception {
        String id=createClient();
        assertThat(race(()->request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PARTIALLY_PAID",40)).statusCode(),
                ()->request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode()))
                .containsExactly(200,200);
        var row=jdbc.queryForMap("select payment_status, received_amount from events where id=?",UUID.fromString(id));
        assertThat(row.get("payment_status")).isIn("PARTIALLY_PAID","PAID");
        assertThat((BigDecimal)row.get("received_amount")).isEqualByComparingTo(row.get("payment_status").equals("PAID")?"100":"40");
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where entity_id=? and action='PAYMENT_UPDATED'",Integer.class,UUID.fromString(id))).isEqualTo(2);
    }
    @Test @Order(1) void aRealDatabaseLockBlocksPaymentUntilCommit() throws Exception {
        String id=createClient(); var locked=new CountDownLatch(1); var release=new CountDownLatch(1);
        var pool=Executors.newFixedThreadPool(2);
        try {
            var holder=pool.submit(()->new TransactionTemplate(transactions).execute(status->{
                events.findForUpdate(UUID.fromString(id)).orElseThrow(); locked.countDown();
                try { if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Lock release timed out"); }
                catch(InterruptedException exception){Thread.currentThread().interrupt();throw new IllegalStateException(exception);} return null;
            }));
            assertThat(locked.await(5,TimeUnit.SECONDS)).isTrue();
            var payment=pool.submit(()->request("PUT","/api/events/"+id+"/payment",ownerToken,payment("PAID",100)).statusCode());
            long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);boolean blocked=false;
            while(System.nanoTime()<until) {
                blocked=jdbc.queryForObject("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock'",Integer.class)>0;
                if(blocked)break;Thread.sleep(20);
            }
            assertThat(blocked).as("PostgreSQL must observe actual lock contention").isTrue();
            assertThat(payment.isDone()).isFalse();release.countDown();holder.get(10,TimeUnit.SECONDS);
            assertThat(payment.get(10,TimeUnit.SECONDS)).isEqualTo(200);
        } finally { release.countDown();pool.shutdownNow(); }
    }
    @Test @Order(1) void twoAdministratorsCannotDeactivateEachOtherLeavingZeroActiveAdmins() throws Exception {
        User other=user("second-admin",UserRole.ADMIN);String otherToken=login(other);
        String body="{\"fullName\":\"Synthetic admin\",\"role\":\"ADMIN\",\"active\":false}";
        var outcomes=race(()->request("PUT","/api/users/"+other.getId(),adminToken,body).statusCode(),
                ()->request("PUT","/api/users/"+admin.getId(),otherToken,body).statusCode());
        assertThat(outcomes).contains(200);
        assertThat(outcomes.stream().filter(status->status==200).count()).isEqualTo(1);
        assertThat(outcomes).allMatch(status->Set.of(200,401,403,404,409).contains(status));
        assertThat(users.countByRoleAndActiveTrue(UserRole.ADMIN)).isEqualTo(1);
    }
    @Test @Order(1) void sharedConsentAndMembershipRevocationUseCurrentGrantsWithTheSameToken() throws Exception {
        var shared=request("POST","/api/calendars",ownerToken,"{\"name\":\"Synthetic shared\",\"calendarType\":\"SHARED\"}");
        assertThat(shared.statusCode()).isEqualTo(201);String sharedId=read(shared,"$.id");
        assertThat(request("POST","/api/calendars/"+sharedId+"/members",ownerToken,"{\"email\":\""+approver.getEmail()+"\",\"role\":\"EDITOR\"}").statusCode()).isEqualTo(204);
        String body="{\"calendarId\":\""+sharedId+"\",\"eventType\":\"SHARED\",\"title\":\"Synthetic consent\",\"startsAt\":\"2030-11-17T12:00:00\",\"endsAt\":\"2030-11-17T13:00:00\",\"approvalRequestedFromEmails\":[\""+approver.getEmail()+"\"]}";
        var event=request("POST","/api/events",ownerToken,body);assertThat(event.statusCode()).isEqualTo(201);String id=read(event,"$.id");
        assertThat(request("POST","/api/events/"+id+"/approve",outsiderToken,null).statusCode()).isEqualTo(403);
        var approved=request("POST","/api/events/"+id+"/approve",approverToken,null);
        assertThat(approved.statusCode()).isEqualTo(200);assertThat((String)read(approved,"$.status")).isEqualTo("APPROVED");
        var another=request("POST","/api/events",ownerToken,body);String rejectedId=read(another,"$.id");
        var rejected=request("POST","/api/events/"+rejectedId+"/reject",approverToken,null);
        assertThat(rejected.statusCode()).isEqualTo(200);
        assertThat((String)read(rejected,"$.status")).isEqualTo("REJECTED");
        String next=read(request("POST","/api/events",ownerToken,body),"$.id");
        var members=request("GET","/api/calendars/"+sharedId+"/members",ownerToken,null);
        List<Map<String,Object>> list=read(members,"$");
        String membership=list.stream().filter(item->approver.getEmail().equals(item.get("userEmail"))).findFirst().orElseThrow().get("id").toString();
        var outcomes=race(()->request("DELETE","/api/calendars/"+sharedId+"/members/"+membership,ownerToken,null).statusCode(),
                ()->request("POST","/api/events/"+next+"/approve",approverToken,null).statusCode());
        assertThat(outcomes.get(0)).isEqualTo(204);
        assertThat(outcomes.get(1)).isIn(200,403);
        assertThat(request("POST","/api/events/"+next+"/approve",approverToken,null).statusCode()).isEqualTo(403);
        assertThat(jdbc.queryForObject("select status from events where id=?",String.class,UUID.fromString(next)))
                .isEqualTo(outcomes.get(1)==200?"APPROVED":"PENDING_APPROVAL");
        assertThat(request("PUT","/api/users/"+owner.getId(),adminToken,"{\"fullName\":\"Inactive synthetic\",\"role\":\"FINANCE\",\"active\":false}").statusCode()).isEqualTo(200);
        assertThat(request("GET","/api/calendars",ownerToken,null).statusCode()).isEqualTo(401);
        assertThat(request("GET","/api/calendars",outsiderToken,null).statusCode()).isEqualTo(200);
    }

    @Test @Order(2) void loginThrottleIsEnforcedOverRealHttpAndDoesNotBlockHealth() throws Exception {
        boolean denied=false;
        for(int i=0;i<101;i++) {
            var response=request("POST","/api/auth/login",null,"{}");
            if(response.statusCode()==429) {
                assertThat(Integer.parseInt(response.headers().firstValue("Retry-After").orElseThrow())).isPositive();
                assertThat(new String(response.body(),StandardCharsets.UTF_8)).doesNotContain("password", "accessToken");
                denied=true;break;
            }
            assertThat(response.statusCode()).isEqualTo(400);
        }
        assertThat(denied).isTrue();
        assertThat(request("GET","/api/health",null,null).statusCode()).isEqualTo(200);
    }
}

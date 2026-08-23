package com.sharedplanner.security;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventRepository;
import com.sharedplanner.event.EventStatus;
import com.sharedplanner.event.EventType;
import com.sharedplanner.event.PaymentMethod;
import com.sharedplanner.event.PaymentStatus;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class ApiSecurityIntegrationTests {

    private static final LocalDateTime START = LocalDateTime.of(2026, 8, 24, 10, 0);
    private static final LocalDateTime END = START.plusHours(1);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SharedCalendarRepository calendarRepository;

    @Autowired
    private CalendarMemberRepository memberRepository;

    @Autowired
    private EventRepository eventRepository;

    @Test
    void rejectsMissingMalformedExpiredWrongIssuerAndDeactivatedTokens() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());

        User active = user("Active", "jwt-active@example.com", UserRole.USER);
        String activeToken = token(active);
        int signatureStart = activeToken.lastIndexOf('.') + 1;
        char firstSignatureCharacter = activeToken.charAt(signatureStart);
        String invalidSignature = activeToken.substring(0, signatureStart)
                + (firstSignatureCharacter == 'a' ? 'b' : 'a')
                + activeToken.substring(signatureStart + 1);

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(invalidSignature)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(
                                active,
                                "shared-planner-api",
                                Instant.now().minusSeconds(300)
                        ))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(
                                active,
                                "another-issuer",
                                Instant.now().plusSeconds(3600)
                        ))))
                .andExpect(status().isUnauthorized());

        active.updateProfile(active.getFullName(), active.getRole(), false, active);
        userRepository.flush();

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(activeToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void enforcesRoleCalendarEventMemberAndApprovalBoundaries() throws Exception {
        User ownerA = user("Owner A", "boundary-owner-a@example.com", UserRole.ADMIN);
        User ownerB = user("Owner B", "boundary-owner-b@example.com", UserRole.ADMIN);
        User actor = user("Actor", "boundary-actor@example.com", UserRole.USER);
        User approvalTarget = user("Target", "boundary-target@example.com", UserRole.USER);
        User otherApprover = user("Other", "boundary-other@example.com", UserRole.USER);

        SharedCalendar calendarA = calendar("Calendar A", ownerA);
        SharedCalendar calendarB = calendar("Calendar B", ownerB);
        member(calendarA, actor, CalendarMemberRole.VIEWER, ownerA);
        member(calendarA, approvalTarget, CalendarMemberRole.EDITOR, ownerA);
        member(calendarA, otherApprover, CalendarMemberRole.EDITOR, ownerA);
        CalendarMember memberB = member(calendarB, actor, CalendarMemberRole.VIEWER, ownerB);

        Event eventB = clientEvent(calendarB, ownerB, new BigDecimal("90.00"));
        Event pending = sharedEvent(calendarA, ownerA, approvalTarget);
        String actorToken = token(actor);

        mockMvc.perform(get("/api/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(actorToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/finance/summary")
                        .param("calendarId", calendarA.getId().toString())
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, bearer(actorToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs")
                        .param("calendarId", calendarA.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer(actorToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/events")
                        .param("calendarId", calendarB.getId().toString())
                        .param("start", START.minusDays(1).toString())
                        .param("end", END.plusDays(1).toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(approvalTarget))))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/events/{eventId}", eventB.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(approvalTarget))))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/calendars/{calendarId}/members/{memberId}",
                        calendarA.getId(), memberB.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"EDITOR\"}")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(ownerA))))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/events/{eventId}/approve", pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(otherApprover))))
                .andExpect(status().isForbidden());
    }

    @Test
    void redactsFinancialFieldsAndDisclosesThemOnlyToApprovedRoles() throws Exception {
        User owner = user("Owner", "finance-owner@example.com", UserRole.ADMIN);
        User creator = user("Creator", "finance-creator@example.com", UserRole.USER);
        User viewer = user("Viewer", "finance-viewer@example.com", UserRole.USER);
        User otherEditor = user("Other editor", "finance-editor@example.com", UserRole.USER);
        User globalFinance = user("Global finance", "finance-global@example.com", UserRole.FINANCE);
        User calendarFinance = user("Calendar finance", "finance-calendar@example.com", UserRole.USER);

        SharedCalendar calendar = calendar("Financial calendar", owner);
        member(calendar, creator, CalendarMemberRole.EDITOR, owner);
        member(calendar, viewer, CalendarMemberRole.VIEWER, owner);
        member(calendar, otherEditor, CalendarMemberRole.EDITOR, owner);
        member(calendar, globalFinance, CalendarMemberRole.VIEWER, owner);
        member(calendar, calendarFinance, CalendarMemberRole.FINANCE, owner);

        Event event = clientEvent(calendar, creator, new BigDecimal("120.00"));
        event.registerPayment(
                PaymentStatus.PAID,
                PaymentMethod.CASH,
                new BigDecimal("120.00"),
                LocalDateTime.of(2026, 8, 24, 12, 0),
                creator
        );
        Event anotherCreatorEvent = clientEvent(
                calendar,
                owner,
                new BigDecimal("80.00"),
                START.plusHours(2)
        );
        anotherCreatorEvent.registerPayment(
                PaymentStatus.PAID,
                PaymentMethod.CASH,
                new BigDecimal("80.00"),
                LocalDateTime.of(2026, 8, 24, 14, 0),
                owner
        );
        eventRepository.flush();

        assertFinancialFieldsAbsent(event, viewer);
        assertFinancialFieldsAbsent(event, otherEditor);

        mockMvc.perform(get("/api/events")
                        .param("calendarId", calendar.getId().toString())
                        .param("start", START.minusDays(1).toString())
                        .param("end", END.plusDays(1).toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(viewer))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].amount").doesNotExist())
                .andExpect(jsonPath("$[0].paymentStatus").doesNotExist())
                .andExpect(jsonPath("$[0].paymentMethod").doesNotExist())
                .andExpect(jsonPath("$[0].receivedAmount").doesNotExist())
                .andExpect(jsonPath("$[0].paidAt").doesNotExist())
                .andExpect(jsonPath("$[1].amount").doesNotExist())
                .andExpect(jsonPath("$[1].paymentStatus").doesNotExist())
                .andExpect(jsonPath("$[1].paymentMethod").doesNotExist())
                .andExpect(jsonPath("$[1].receivedAmount").doesNotExist())
                .andExpect(jsonPath("$[1].paidAt").doesNotExist());

        mockMvc.perform(get("/api/events")
                        .param("calendarId", calendar.getId().toString())
                        .param("start", START.minusDays(1).toString())
                        .param("end", END.plusDays(1).toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(creator))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].amount").value(120.00))
                .andExpect(jsonPath("$[0].paymentStatus").value("PAID"))
                .andExpect(jsonPath("$[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$[0].receivedAmount").value(120.00))
                .andExpect(jsonPath("$[0].paidAt").exists())
                .andExpect(jsonPath("$[1].amount").doesNotExist())
                .andExpect(jsonPath("$[1].paymentStatus").doesNotExist())
                .andExpect(jsonPath("$[1].paymentMethod").doesNotExist())
                .andExpect(jsonPath("$[1].receivedAmount").doesNotExist())
                .andExpect(jsonPath("$[1].paidAt").doesNotExist());

        assertFinancialFieldsPresent(event, owner);
        assertFinancialFieldsPresent(event, creator);
        assertFinancialFieldsPresent(event, globalFinance);
        assertFinancialFieldsPresent(event, calendarFinance);
    }

    @Test
    void removedApprovalTargetCannotListApproveOrRejectPendingEvent() throws Exception {
        User owner = user("Owner", "revoked-owner@example.com", UserRole.ADMIN);
        User target = user("Target", "revoked-target@example.com", UserRole.USER);
        SharedCalendar calendar = calendar("Revocation calendar", owner);
        CalendarMember targetMembership = member(calendar, target, CalendarMemberRole.EDITOR, owner);
        Event pending = sharedEvent(calendar, owner, target);

        memberRepository.delete(targetMembership);
        memberRepository.flush();
        String targetToken = token(target);

        mockMvc.perform(get("/api/events/pending-approvals")
                        .header(HttpHeaders.AUTHORIZATION, bearer(targetToken)))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        mockMvc.perform(post("/api/events/{eventId}/approve", pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(targetToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/events/{eventId}/reject", pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(targetToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void userContractsNeverExposePasswordOrHash() throws Exception {
        User admin = user("Contract admin", "contract-admin@example.com", UserRole.ADMIN);
        String adminToken = token(admin);

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        mockMvc.perform(get("/api/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].password").doesNotExist())
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    void ownerRoleCannotBeDemotedThroughUpdateOrMemberUpsert() throws Exception {
        User owner = user("Owner", "owner-invariant@example.com", UserRole.ADMIN);
        SharedCalendar calendar = calendar("Owner invariant", owner);
        CalendarMember ownerMembership = memberRepository
                .findByCalendarIdAndUserId(calendar.getId(), owner.getId())
                .orElseThrow();
        String ownerToken = token(owner);

        mockMvc.perform(put("/api/calendars/{calendarId}/members/{memberId}",
                        calendar.getId(), ownerMembership.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"VIEWER\"}")
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/calendars/{calendarId}/members", calendar.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"owner-invariant@example.com\",\"role\":\"EDITOR\"}")
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsPaymentAmountsBeyondDatabasePrecisionContract() throws Exception {
        User owner = user("Owner", "digits-owner@example.com", UserRole.ADMIN);
        SharedCalendar calendar = calendar("Digits calendar", owner);
        Event event = clientEvent(calendar, owner, new BigDecimal("100.00"));

        mockMvc.perform(put("/api/events/{eventId}/payment", event.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentStatus": "PARTIALLY_PAID",
                                  "paymentMethod": "CASH",
                                  "receivedAmount": 1.234
                                }
                                """)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(owner))))
                .andExpect(status().isBadRequest());
    }

    private void assertFinancialFieldsAbsent(Event event, User user) throws Exception {
        mockMvc.perform(get("/api/events/{eventId}", event.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(user))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").doesNotExist())
                .andExpect(jsonPath("$.paymentStatus").doesNotExist())
                .andExpect(jsonPath("$.paymentMethod").doesNotExist())
                .andExpect(jsonPath("$.receivedAmount").doesNotExist())
                .andExpect(jsonPath("$.paidAt").doesNotExist());
    }

    private void assertFinancialFieldsPresent(Event event, User user) throws Exception {
        mockMvc.perform(get("/api/events/{eventId}", event.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(user))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").exists())
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.receivedAmount").exists())
                .andExpect(jsonPath("$.paidAt").exists());
    }

    private User user(String name, String email, UserRole role) {
        return userRepository.save(new User(name, email, "unused", role, null));
    }

    private SharedCalendar calendar(String name, User owner) {
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(name, owner));
        member(calendar, owner, CalendarMemberRole.ADMIN, owner);
        return calendar;
    }

    private CalendarMember member(
            SharedCalendar calendar,
            User user,
            CalendarMemberRole role,
            User createdBy
    ) {
        return memberRepository.save(new CalendarMember(calendar, user, role, createdBy));
    }

    private Event clientEvent(SharedCalendar calendar, User creator, BigDecimal amount) {
        return clientEvent(calendar, creator, amount, START);
    }

    private Event clientEvent(
            SharedCalendar calendar,
            User creator,
            BigDecimal amount,
            LocalDateTime startsAt
    ) {
        Event event = new Event(calendar, creator);
        event.fill(
                EventType.CLIENT,
                EventStatus.SCHEDULED,
                "Client appointment",
                "Client",
                "ignored-person",
                "Description",
                "Service",
                amount,
                startsAt,
                startsAt.plusHours(1),
                null,
                creator
        );
        return eventRepository.save(event);
    }

    private Event sharedEvent(SharedCalendar calendar, User creator, User approvalTarget) {
        Event event = new Event(calendar, creator);
        event.fill(
                EventType.SHARED,
                EventStatus.PENDING_APPROVAL,
                "Shared event",
                null,
                null,
                "Description",
                null,
                null,
                START,
                END,
                approvalTarget,
                creator
        );
        return eventRepository.save(event);
    }

    private String token(User user) {
        return token(user, "shared-planner-api", Instant.now().plusSeconds(3600));
    }

    private String token(User user, String issuer, Instant expiresAt) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(expiresAt.isBefore(now) ? expiresAt.minusSeconds(3600) : now)
                .expiresAt(expiresAt)
                .subject(user.getEmail())
                .claim("scope", "ROLE_" + user.getRole().name())
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}

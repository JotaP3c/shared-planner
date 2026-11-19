package com.sharedplanner.catalog;

import com.jayway.jsonpath.JsonPath;
import com.sharedplanner.access.AccessControlService;
import com.sharedplanner.access.Permission;
import com.sharedplanner.access.ProfileScope;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class CatalogIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired AccessControlService access;
    @Autowired AuditService audit;

    @Test
    void catalogsAreCalendarScopedAndOnlyFinancialReadersSeePrices() throws Exception {
        User owner = user(UserRole.USER);
        User otherOwner = user(UserRole.USER);
        User finance = user(UserRole.USER);
        User editor = user(UserRole.USER);
        SharedCalendar main = calendar(owner);
        SharedCalendar other = calendar(otherOwner);
        members.save(new CalendarMember(main, finance, CalendarMemberRole.FINANCE, owner));
        members.save(new CalendarMember(main, editor, CalendarMemberRole.EDITOR, owner));
        String service = create(main, owner, withoutPromotion("Brow service", "SERVICE", "45", 35));
        String product = create(main, owner, withoutPromotion("Care kit", "PRODUCT", "30.20", null));
        create(other, otherOwner, withoutPromotion("Other private service", "SERVICE", "397.85", 45));

        mvc.perform(get(catalog(main)).param("q", "CARE").param("type", "PRODUCT")
                        .param("active", "true").param("category", "clients").param("size", "1")
                        .with(jwt().jwt(token -> token.subject(finance.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(product))
                .andExpect(jsonPath("$.items[0].calendarId").value(main.getId().toString()))
                .andExpect(jsonPath("$.items[0].durationMinutes").doesNotExist())
                .andExpect(jsonPath("$.items[0].effectivePrice").value(30.20));
        mvc.perform(get(catalog(main)).with(jwt().jwt(token -> token.subject(finance.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(catalog(other)).with(jwt().jwt(token -> token.subject(finance.getEmail()))))
                .andExpect(status().isNotFound());
        mvc.perform(get(catalog(other) + "/" + service)
                        .with(jwt().jwt(token -> token.subject(otherOwner.getEmail()))))
                .andExpect(status().isNotFound());
        mvc.perform(get(catalog(main)).with(jwt().jwt(token -> token.subject(editor.getEmail()))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.items").doesNotExist());
        mvc.perform(get(catalog(main) + "/" + service + "/price-history")
                        .with(jwt().jwt(token -> token.subject(editor.getEmail()))))
                .andExpect(status().isForbidden());
        mvc.perform(post(catalog(main)).contentType(MediaType.APPLICATION_JSON)
                        .content(withoutPromotion("Forbidden", "PRODUCT", "1", null))
                        .with(jwt().jwt(token -> token.subject(finance.getEmail()))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/users").with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void promotionsUseInclusiveAppointmentDatesAndChangesRetainPriceHistory() throws Exception {
        User owner = user(UserRole.USER);
        SharedCalendar calendar = calendar(owner);
        String promo = """
                {"name":"Brow service","type":"SERVICE","standardPrice":100.00,"promotionalPrice":75.25,
                 "promotionStartDate":"2026-12-10","promotionEndDate":"2026-12-15","durationMinutes":45,
                 "active":true}
                """;
        String id = create(calendar, owner, promo);
        String uri = catalog(calendar) + "/" + id;
        for (String date : new String[]{"2026-12-10", "2026-12-15"}) {
            mvc.perform(get(uri).param("appointmentDate", date).with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.effectivePrice").value(75.25))
                    .andExpect(jsonPath("$.promotionApplied").value(true));
        }
        for (String date : new String[]{"2026-12-09", "2026-12-16"}) {
            mvc.perform(get(uri).param("appointmentDate", date).with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.effectivePrice").value(100))
                    .andExpect(jsonPath("$.promotionApplied").value(false));
        }

        String update = withVersion(withoutPromotion("Brow service", "SERVICE", "115", 45), 0);
        mvc.perform(put(uri).contentType(MediaType.APPLICATION_JSON).content(update)
                        .with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.effectivePrice").value(115));
        mvc.perform(put(uri).contentType(MediaType.APPLICATION_JSON).content(update)
                        .with(jwt().jwt(token -> token.subject(owner.getEmail())))).andExpect(status().isConflict());
        mvc.perform(put(uri).contentType(MediaType.APPLICATION_JSON)
                        .content(withVersion(withoutPromotion("Brow service", "SERVICE", "115", 45)
                                .replace("true", "false"), 1))
                        .with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(get(catalog(calendar)).param("active", "true").with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(uri + "/price-history").with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].standardPrice").value(115))
                .andExpect(jsonPath("$[1].promotionalPrice").value(75.25));
        mvc.perform(get(uri + "/price-history").param("size", "1").param("page", "1")
                        .with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].standardPrice").value(100));
        assertThat(audit.search(calendar.getId(), AuditEntityType.CATALOG_ITEM, UUID.fromString(id), 10, actor(owner)))
                .hasSize(3).allSatisfy(entry -> {
                    assertThat(entry.oldValue()).isNull();
                    assertThat(entry.newValue()).isNull();
                    assertThat(entry.summary()).doesNotContain("115", "75.25", "100");
                });
    }

    @Test
    void invalidPromotionAndMoneyPrecisionAreRejected() throws Exception {
        User owner = user(UserRole.USER);
        SharedCalendar calendar = calendar(owner);
        for (String body : new String[]{
                "{\"name\":\"Invalid\",\"type\":\"SERVICE\",\"standardPrice\":10,\"promotionalPrice\":5,\"active\":true}",
                "{\"name\":\"Invalid\",\"type\":\"SERVICE\",\"standardPrice\":10,\"promotionalPrice\":10,\"promotionStartDate\":\"2026-12-10\",\"promotionEndDate\":\"2026-12-15\",\"active\":true}",
                withoutPromotion("Invalid", "PRODUCT", "5.001", null),
                withoutPromotion("Invalid", "PRODUCT", "-1.00", null)}) {
            mvc.perform(post(catalog(calendar)).contentType(MediaType.APPLICATION_JSON).content(body)
                            .with(jwt().jwt(token -> token.subject(owner.getEmail())))).andExpect(status().isBadRequest());
        }
        mvc.perform(get(catalog(calendar)).param("size", "101").with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(catalog(calendar)).with(jwt().jwt(token -> token.subject(owner.getEmail()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void configuredGrantsRequireFinancialViewAndRevocationIsReadOnEveryRequest() throws Exception {
        User system = user(UserRole.ADMIN);
        User owner = user(UserRole.USER);
        User delegate = user(UserRole.USER);
        SharedCalendar calendar = calendar(owner);
        members.save(new CalendarMember(calendar, delegate, CalendarMemberRole.VIEWER, owner));
        var full = access.create(new AccessControlService.CreateProfileRequest("Commercial editor", ProfileScope.CALENDAR,
                true, Set.of(Permission.CALENDAR_VIEW, Permission.FINANCE_VIEW, Permission.CATALOG_VIEW,
                        Permission.CATALOG_MANAGE)), actor(system));
        var missingFinance = access.create(new AccessControlService.CreateProfileRequest("No finance", ProfileScope.CALENDAR,
                true, Set.of(Permission.CALENDAR_VIEW, Permission.CATALOG_VIEW, Permission.CATALOG_MANAGE)), actor(system));
        access.assign(new AccessControlService.AssignmentRequest(delegate.getId(), calendar.getId(), Set.of(full.id())), actor(owner));
        create(calendar, delegate, withoutPromotion("Configured service", "SERVICE", "95", 45));
        var token = jwt().jwt(claims -> claims.subject(delegate.getEmail()));
        mvc.perform(get(catalog(calendar)).with(token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        access.assign(new AccessControlService.AssignmentRequest(delegate.getId(), calendar.getId(),
                Set.of(missingFinance.id())), actor(owner));
        mvc.perform(get(catalog(calendar)).with(token)).andExpect(status().isForbidden());
    }

    private String create(SharedCalendar calendar, User owner, String body) throws Exception {
        return JsonPath.read(mvc.perform(post(catalog(calendar)).contentType(MediaType.APPLICATION_JSON).content(body)
                        .with(jwt().jwt(token -> token.subject(owner.getEmail())))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(), "$.id");
    }

    private static String withoutPromotion(String name, String type, String value, Integer duration) {
        return """
                {"name":"%s","type":"%s","code":"SKU","description":"Public service description",
                 "standardPrice":%s,"durationMinutes":%s,"category":"Clients","active":true}
                """.formatted(name, type, value, duration);
    }

    private static String withVersion(String body, int version) {
        return body.strip().replaceFirst("}$", ",\"version\":" + version + "}");
    }

    private User user(UserRole role) {
        return users.save(new User("Synthetic", UUID.randomUUID() + "@catalog.invalid", "test-only", role, null));
    }

    private SharedCalendar calendar(User owner) {
        var calendar = calendars.save(new SharedCalendar("Catalog fixture", owner));
        members.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        return calendar;
    }

    private static Authentication actor(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }

    private static String catalog(SharedCalendar calendar) {
        return "/api/calendars/" + calendar.getId() + "/catalog";
    }
}

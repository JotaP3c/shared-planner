package com.sharedplanner.access;

import com.sharedplanner.audit.*;
import com.sharedplanner.calendar.*;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.*;
import com.sharedplanner.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties="spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class AccessControlIntegrationTests {
    @Autowired AccessControlService access;
    @Autowired AuthorizationService authorization;
    @Autowired AccessProfileRepository profiles;
    @Autowired AccessAssignmentRepository assignments;
    @Autowired UserRepository users;
    @Autowired CalendarService calendarService;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired EventService events;
    @Autowired AuditService audit;
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    private static final LocalDateTime START=LocalDateTime.of(2026,11,12,10,0);

    @Test
    void legacyCombinedRolesRemainContextualAndGlobalFinanceRequiresMembership() {
        Fixture f=fixture();
        CalendarMember member=member(f.calendar,f.person);
        member.changeRoles(Set.of(CalendarMemberRole.EDITOR,CalendarMemberRole.FINANCE),f.owner);
        var effective=authorization.calendarPermissions(f.calendar.getId(),auth(f.person));
        assertThat(effective).contains(Permission.EVENT_CREATE,Permission.EVENT_EDIT,Permission.FINANCE_VIEW,Permission.FINANCE_EXPORT)
                .doesNotContain(Permission.MEMBERS_MANAGE,Permission.USERS_MANAGE,Permission.ROLES_MANAGE);
        User finance=user(UserRole.FINANCE);
        deny(()->authorization.ensureCanUseFinance(f.calendar.getId(),auth(finance)),HttpStatus.NOT_FOUND);
        members.save(new CalendarMember(f.calendar,finance,CalendarMemberRole.VIEWER,f.owner));
        authorization.ensureCanUseFinance(f.calendar.getId(),auth(finance));
        deny(()->authorization.ensureCanManageCalendar(f.calendar.getId(),auth(finance)),HttpStatus.FORBIDDEN);
    }

    @Test
    void explicitProfilesReplaceLegacyDefaultsAndRevocationsTakeEffectImmediately() {
        Fixture f=fixture();member(f.calendar,f.person).changeRole(CalendarMemberRole.EDITOR,f.owner);
        var readonly=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.MEMBERS_VIEW));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(readonly.id())),auth(f.owner));
        authorization.ensureCalendarVisible(f.calendar.getId(),auth(f.person));
        deny(()->authorization.ensureCanCreateEvent(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
        access.update(readonly.id(),new AccessControlService.UpdateProfileRequest("Configurable editor",true,Set.of(Permission.CALENDAR_VIEW,Permission.EVENT_CREATE)),auth(f.admin));
        authorization.ensureCanCreateEvent(f.calendar.getId(),auth(f.person));
        access.update(readonly.id(),new AccessControlService.UpdateProfileRequest("Disabled",false,Set.of(Permission.CALENDAR_VIEW,Permission.EVENT_CREATE)),auth(f.admin));
        deny(()->authorization.ensureCalendarVisible(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
        assertThat(calendarService.list(auth(f.person))).isEmpty();
        access.restoreDefaults(f.person.getId(),f.calendar.getId(),auth(f.owner));
        authorization.ensureCanCreateEvent(f.calendar.getId(),auth(f.person));
    }

    @Test
    void globalFeatureGateRestrictsContextualAdminWithoutChangingGlobalRole() {
        Fixture f=fixture();
        var readonly=profile(f.admin,ProfileScope.GLOBAL,Set.of(Permission.CALENDAR_VIEW,Permission.SETTINGS_VIEW));
        access.assign(new AccessControlService.AssignmentRequest(f.owner.getId(),null,Set.of(readonly.id())),auth(f.admin));
        authorization.ensureCalendarVisible(f.calendar.getId(),auth(f.owner));
        deny(()->authorization.ensureCanCreateEvent(f.calendar.getId(),auth(f.owner)),HttpStatus.FORBIDDEN);
        assertThat(f.owner.getRole()).isEqualTo(UserRole.USER);
        assertThat(member(f.calendar,f.owner).getRoles()).contains(CalendarMemberRole.ADMIN);
        access.restoreDefaults(f.owner.getId(),null,auth(f.admin));
        authorization.ensureCanManageCalendar(f.calendar.getId(),auth(f.owner));
    }

    @Test
    void financeManagerCanPayWithoutEditingEventsAndExporterMustAlsoHaveView() {
        Fixture f=fixture();
        var manager=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.FINANCE_VIEW,Permission.FINANCE_MANAGE,Permission.FINANCE_EXPORT));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(manager.id())),auth(f.owner));
        EventResponse event=events.create(client(f.calendar),auth(f.owner));
        events.updatePayment(event.id(),new UpdatePaymentRequest(PaymentStatus.PAID,PaymentMethod.PIX,BigDecimal.TEN,START),auth(f.person));
        Event model=new Event(f.calendar,f.owner);
        deny(()->authorization.ensureCanEditEvent(model,auth(f.person)),HttpStatus.FORBIDDEN);
        authorization.ensureCanExportFinance(f.calendar.getId(),auth(f.person));
        access.update(manager.id(),new AccessControlService.UpdateProfileRequest("Export without read",true,Set.of(Permission.CALENDAR_VIEW,Permission.FINANCE_EXPORT)),auth(f.admin));
        deny(()->authorization.ensureCanExportFinance(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
        assertThat(authorization.calendarPermissions(f.calendar.getId(),auth(f.person))).doesNotContain(Permission.FINANCE_EXPORT);
        access.update(manager.id(),new AccessControlService.UpdateProfileRequest("Read without export",true,Set.of(Permission.CALENDAR_VIEW,Permission.FINANCE_VIEW)),auth(f.admin));
        authorization.ensureCanUseFinance(f.calendar.getId(),auth(f.person));
        deny(()->authorization.ensureCanExportFinance(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
    }

    @Test
    void permissionsOnOneCalendarNeverGrantAccessToAnother() {
        Fixture f=fixture();SharedCalendar other=calendar(f.owner);
        members.save(new CalendarMember(other,f.person,CalendarMemberRole.VIEWER,f.owner));
        var creator=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.EVENT_CREATE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(creator.id())),auth(f.owner));
        authorization.ensureCanCreateEvent(f.calendar.getId(),auth(f.person));
        deny(()->authorization.ensureCanCreateEvent(other.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
        deny(()->authorization.ensureCanCreateEvent(UUID.randomUUID(),auth(f.person)),HttpStatus.NOT_FOUND);
    }

    @Test
    void customCreatorWithoutFinancialReadCannotSeeOrManageClientValues() {
        Fixture f=fixture();
        var creator=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.EVENT_CREATE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(creator.id())),auth(f.owner));
        EventResponse created=events.create(client(f.calendar),auth(f.person));
        assertThat(created.amount()).isNull();
        assertThat(events.findById(created.id(),auth(f.person)).receivedAmount()).isNull();
        deny(()->events.updatePayment(created.id(),new UpdatePaymentRequest(PaymentStatus.PAID,PaymentMethod.PIX,BigDecimal.TEN,START),auth(f.person)),HttpStatus.FORBIDDEN);
        deny(()->authorization.ensureCanImportCalendar(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
    }

    @Test
    void explicitUserViewAllowsReadOnlyUserScreenWithoutGlobalRoleEscalation() throws Exception {
        Fixture f=fixture();
        var viewer=profile(f.admin,ProfileScope.GLOBAL,Set.of(Permission.USERS_VIEW));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),null,Set.of(viewer.id())),auth(f.admin));
        mvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION,token(f.person))).andExpect(status().isOk());
        mvc.perform(post("/api/users").header(HttpHeaders.AUTHORIZATION,token(f.person)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Synthetic user\",\"email\":\"new@example.invalid\",\"password\":\"fixture-password\",\"role\":\"USER\"}"))
                .andExpect(status().isForbidden());
        assertThat(f.person.getRole()).isEqualTo(UserRole.USER);
    }

    @Test
    void calendarAdminCannotCreateProfilesAssignGlobalAccessOrModifyEssentialAdmins() {
        Fixture f=fixture();
        deny(()->profile(f.owner,ProfileScope.GLOBAL,Set.of(Permission.ROLES_MANAGE)),HttpStatus.FORBIDDEN);
        deny(()->access.assign(new AccessControlService.AssignmentRequest(f.owner.getId(),null,Set.of()),auth(f.owner)),HttpStatus.FORBIDDEN);
        deny(()->access.assign(new AccessControlService.AssignmentRequest(f.admin.getId(),null,Set.of()),auth(f.admin)),HttpStatus.BAD_REQUEST);
        deny(()->access.assign(new AccessControlService.AssignmentRequest(f.owner.getId(),f.calendar.getId(),Set.of()),auth(f.owner)),HttpStatus.BAD_REQUEST);
        deny(()->profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.USERS_MANAGE)),HttpStatus.BAD_REQUEST);
        var adminProfile=access.list(null,auth(f.admin)).stream().filter(p->p.code().equals("SYSTEM_ADMIN")).findFirst().orElseThrow();
        deny(()->access.update(adminProfile.id(),new AccessControlService.UpdateProfileRequest("Disabled admin",false,Set.of()),auth(f.admin)),HttpStatus.BAD_REQUEST);
    }

    @Test
    void delegatedGlobalRoleManagerCannotGrantPermissionsTheyDoNotHold() {
        Fixture f=fixture();
        var manager=profile(f.admin,ProfileScope.GLOBAL,Set.of(Permission.ROLES_MANAGE,Permission.SETTINGS_VIEW));
        var usersManager=profile(f.admin,ProfileScope.GLOBAL,Set.of(Permission.USERS_MANAGE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),null,Set.of(manager.id())),auth(f.admin));
        deny(()->access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),null,Set.of(usersManager.id())),auth(f.person)),HttpStatus.FORBIDDEN);
        deny(()->profile(f.person,ProfileScope.GLOBAL,Set.of(Permission.USERS_MANAGE)),HttpStatus.FORBIDDEN);
    }

    @Test
    void reducedGlobalManagerCannotEscalateByRestoringDefaultProfileOrLegacyRole() throws Exception {
        Fixture f=fixture();
        var manager=profile(f.admin,ProfileScope.GLOBAL,Set.of(Permission.ROLES_MANAGE,Permission.USERS_VIEW,Permission.USERS_MANAGE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),null,Set.of(manager.id())),auth(f.admin));
        deny(()->access.restoreDefaults(f.person.getId(),null,auth(f.person)),HttpStatus.FORBIDDEN);
        mvc.perform(put("/api/users/"+f.owner.getId()).header(HttpHeaders.AUTHORIZATION,token(f.person)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Synthetic owner\",\"role\":\"FINANCE\",\"active\":true}"))
                .andExpect(status().isForbidden());
        assertThat(f.owner.getRole()).isEqualTo(UserRole.USER);
    }

    @Test
    void emptyAssignmentDeniesByDefaultAndRoleChangeClearsStaleCustomGrant() {
        Fixture f=fixture();
        var custom=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.MEMBERS_MANAGE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(custom.id())),auth(f.owner));
        CalendarMember member=member(f.calendar,f.person);
        calendarService.updateMember(f.calendar.getId(),member.getId(),new UpdateCalendarMemberRequest(CalendarMemberRole.VIEWER),auth(f.owner));
        deny(()->authorization.ensureCanManageCalendar(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of()),auth(f.owner));
        deny(()->authorization.ensureCalendarVisible(f.calendar.getId(),auth(f.person)),HttpStatus.FORBIDDEN);
    }

    @Test
    void reducedCalendarManagerCannotEscalateThroughLegacyRoleOrDefaultReset() throws Exception {
        Fixture f=fixture();
        CalendarMember membership=member(f.calendar,f.person);
        membership.changeRole(CalendarMemberRole.EDITOR,f.owner);
        var manager=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW,Permission.MEMBERS_VIEW,Permission.MEMBERS_MANAGE));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(manager.id())),auth(f.owner));
        String jwt=token(f.person);
        mvc.perform(put("/api/calendars/"+f.calendar.getId()+"/members/"+membership.getId())
                .header(HttpHeaders.AUTHORIZATION,jwt).contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/access/assignments").param("userId",f.person.getId().toString()).param("calendarId",f.calendar.getId().toString())
                .header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        assertThat(authorization.calendarPermissions(f.calendar.getId(),auth(f.person))).doesNotContain(Permission.EVENT_CREATE,Permission.FINANCE_VIEW);
        assertThat(assignments.findByUserIdAndContextKey(f.person.getId(),AccessAssignment.key(f.calendar.getId()))).isPresent();
    }

    @Test
    void profileAndAssignmentChangesAreAuditedAndEffectiveResultsCanBeInspected() {
        Fixture f=fixture();var p=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(p.id())),auth(f.owner));
        var effective=access.effective(f.person.getId(),f.calendar.getId(),auth(f.owner));
        assertThat(effective.calendars()).singleElement().satisfies(c->assertThat(c.permissions()).containsExactly(Permission.CALENDAR_VIEW));
        assertThat(audit.search(null,AuditEntityType.ACCESS_PROFILE,p.id(),10,auth(f.admin))).hasSize(1);
        assertThat(audit.search(f.calendar.getId(),AuditEntityType.ACCESS_ASSIGNMENT,null,10,auth(f.owner))).hasSize(1);
        deny(()->access.effective(f.owner.getId(),null,auth(f.person)),HttpStatus.FORBIDDEN);
    }

    @Test
    void directRestAccessAndSameJwtRevocationAreEnforced() throws Exception {
        Fixture f=fixture();String jwt=token(f.person);
        mvc.perform(get("/api/access/profiles")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/access/profiles").header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        mvc.perform(put("/api/access/assignments").header(HttpHeaders.AUTHORIZATION,jwt).contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\""+f.person.getId()+"\",\"profileIds\":[]}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/events").param("calendarId",f.calendar.getId().toString()).param("start",START.toString()).param("end",START.plusDays(1).toString()).header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isOk());
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of()),auth(f.owner));
        mvc.perform(get("/api/events").param("calendarId",f.calendar.getId().toString()).param("start",START.toString()).param("end",START.plusDays(1).toString()).header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        mvc.perform(get("/api/events/search").param("term","appointment").header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void directEventRestOperationsRespectIndividualGrantsAndHideClientFinancialFields() throws Exception {
        Fixture f=fixture();
        EventResponse client=events.create(client(f.calendar),auth(f.owner));
        EventResponse invitation=events.create(new CreateEventRequest(f.calendar.getId(),EventType.SHARED,"Fixture invitation",null,null,
                "Invitation",null,null,START.plusHours(2),START.plusHours(3),f.person.getEmail()),auth(f.owner));
        var viewer=profile(f.admin,ProfileScope.CALENDAR,Set.of(Permission.CALENDAR_VIEW));
        access.assign(new AccessControlService.AssignmentRequest(f.person.getId(),f.calendar.getId(),Set.of(viewer.id())),auth(f.owner));
        String jwt=token(f.person);
        String body="{\"calendarId\":\""+f.calendar.getId()+"\",\"eventType\":\"CLIENT\",\"title\":\"Fixture client\",\"clientName\":\"Fixture client\",\"description\":\"Service\",\"workDescription\":\"Service\",\"amount\":10,\"startsAt\":\"2026-11-12T10:00:00\",\"endsAt\":\"2026-11-12T10:30:00\"}";
        mvc.perform(get("/api/events/"+client.id()).header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").doesNotExist()).andExpect(jsonPath("$.receivedAmount").doesNotExist());
        mvc.perform(post("/api/events").header(HttpHeaders.AUTHORIZATION,jwt).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(put("/api/events/"+client.id()).header(HttpHeaders.AUTHORIZATION,jwt).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/events/"+client.id()).header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        mvc.perform(put("/api/events/"+client.id()+"/payment").header(HttpHeaders.AUTHORIZATION,jwt).contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentStatus\":\"PAID\",\"paymentMethod\":\"PIX\",\"receivedAmount\":10,\"paidAt\":\"2026-11-12T10:30:00\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/events/"+client.id()+"/confirm").header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        mvc.perform(post("/api/events/"+invitation.id()+"/approve").header(HttpHeaders.AUTHORIZATION,jwt)).andExpect(status().isForbidden());
        assertThat(events.findById(client.id(),auth(f.owner)).paymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(events.findById(invitation.id(),auth(f.owner)).status()).isEqualTo(EventStatus.PENDING_APPROVAL);
    }

    private Fixture fixture(){User admin=user(UserRole.ADMIN),owner=user(UserRole.USER),person=user(UserRole.USER);SharedCalendar calendar=calendar(owner);members.save(new CalendarMember(calendar,person,CalendarMemberRole.VIEWER,owner));return new Fixture(admin,owner,person,calendar);}
    private User user(UserRole role){String key=UUID.randomUUID().toString();return users.save(new User("Fixture "+key.substring(0,8),key+"@example.invalid","unused",role,null));}
    private SharedCalendar calendar(User owner){SharedCalendar c=calendars.save(new SharedCalendar("Fixture calendar",owner,CalendarType.PERSONAL));members.save(new CalendarMember(c,owner,CalendarMemberRole.ADMIN,owner));return c;}
    private CalendarMember member(SharedCalendar c,User u){return members.findByCalendarIdAndUserId(c.getId(),u.getId()).orElseThrow();}
    private AccessControlService.ProfileResponse profile(User admin,ProfileScope scope,Set<Permission> permissions){return access.create(new AccessControlService.CreateProfileRequest("Fixture profile",scope,true,permissions),auth(admin));}
    private CreateEventRequest client(SharedCalendar c){return new CreateEventRequest(c.getId(),EventType.CLIENT,"Fixture appointment","Fixture client",null,"Service","Service",BigDecimal.TEN,START,START.plusMinutes(30),null);}
    private UsernamePasswordAuthenticationToken auth(User user){return new UsernamePasswordAuthenticationToken(user.getEmail(),null);}
    private String token(User user){Instant now=Instant.now();return "Bearer "+encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),JwtClaimsSet.builder().issuer("shared-planner-api").subject(user.getEmail()).issuedAt(now).expiresAt(now.plusSeconds(3600)).build())).getTokenValue();}
    private void deny(Runnable task,HttpStatus status){assertThatThrownBy(task::run).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode()).isEqualTo(status));}
    private record Fixture(User admin,User owner,User person,SharedCalendar calendar) { }
}

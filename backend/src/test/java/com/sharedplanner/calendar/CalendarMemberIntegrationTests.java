package com.sharedplanner.calendar;

import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** INC-03 — adicionar membro concede acesso a contas existentes e ativas; nunca cria contas. */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class CalendarMemberIntegrationTests {

    @Autowired private CalendarService calendarService;
    @Autowired private UserRepository userRepository;
    @Autowired private SharedCalendarRepository calendarRepository;
    @Autowired private CalendarMemberRepository memberRepository;

    @Test
    void addsExistingActiveUserWithTheRequestedRoleAndNormalizedEmail() {
        Fixture fixture = fixture("member-ok");
        User existing = user("member-ok-target@example.com", UserRole.USER);

        calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest("  Member-OK-Target@Example.com ", CalendarMemberRole.ADMIN), fixture.auth());

        CalendarMember member = memberRepository
                .findByCalendarIdAndUserId(fixture.calendar().getId(), existing.getId())
                .orElseThrow();
        assertThat(member.getRole()).isEqualTo(CalendarMemberRole.ADMIN);
        assertThat(calendarService.listMembers(fixture.calendar().getId(), fixture.auth())).hasSize(2);
    }

    @Test
    void unknownEmailIsNotFoundAndNoAccountIsCreated() {
        Fixture fixture = fixture("member-unknown");
        long usersBefore = userRepository.count();

        assertStatus(() -> calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest("nobody@example.com", CalendarMemberRole.VIEWER), fixture.auth()),
                HttpStatus.NOT_FOUND, "User not found");

        assertThat(userRepository.count()).isEqualTo(usersBefore);
    }

    @Test
    void inactiveUserIsConflict() {
        Fixture fixture = fixture("member-inactive");
        User inactive = user("member-inactive-target@example.com", UserRole.USER);
        inactive.updateProfile(inactive.getFullName(), UserRole.USER, false, fixture.owner());
        userRepository.flush();

        assertStatus(() -> calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest(inactive.getEmail(), CalendarMemberRole.VIEWER), fixture.auth()),
                HttpStatus.CONFLICT, "inactive");
    }

    @Test
    void duplicateMembershipIsConflictAndDoesNotChangeRole() {
        Fixture fixture = fixture("member-duplicate");
        User existing = user("member-duplicate-target@example.com", UserRole.USER);
        calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest(existing.getEmail(), CalendarMemberRole.VIEWER), fixture.auth());

        assertStatus(() -> calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest(existing.getEmail(), CalendarMemberRole.ADMIN), fixture.auth()),
                HttpStatus.CONFLICT, "already a member");

        assertThat(memberRepository.findByCalendarIdAndUserId(fixture.calendar().getId(), existing.getId())
                .orElseThrow().getRole()).isEqualTo(CalendarMemberRole.VIEWER);
        assertThat(memberRepository.findByCalendarIdOrderByCreatedAtAsc(fixture.calendar().getId())).hasSize(2);
    }

    @Test
    void nonAdminMemberCannotAddMembers() {
        Fixture fixture = fixture("member-forbidden");
        User editor = user("member-forbidden-editor@example.com", UserRole.USER);
        memberRepository.save(new CalendarMember(fixture.calendar(), editor, CalendarMemberRole.EDITOR, fixture.owner()));
        User target = user("member-forbidden-target@example.com", UserRole.USER);

        assertStatus(() -> calendarService.addMember(fixture.calendar().getId(),
                new AddCalendarMemberRequest(target.getEmail(), CalendarMemberRole.VIEWER),
                new UsernamePasswordAuthenticationToken(editor.getEmail(), null)),
                HttpStatus.FORBIDDEN, "");
    }

    @Test
    void unknownCalendarIsNotFound() {
        Fixture fixture = fixture("member-no-calendar");
        User globalAdmin = user("member-no-calendar-admin@example.com", UserRole.ADMIN);
        User target = user("member-no-calendar-target@example.com", UserRole.USER);

        assertStatus(() -> calendarService.addMember(UUID.randomUUID(),
                new AddCalendarMemberRequest(target.getEmail(), CalendarMemberRole.VIEWER),
                new UsernamePasswordAuthenticationToken(globalAdmin.getEmail(), null)),
                HttpStatus.NOT_FOUND, "Calendar not found");
        assertThat(fixture.calendar()).isNotNull();
    }

    private void assertStatus(Runnable action, HttpStatus status, String message) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(status);
                    assertThat(error.getReason()).contains(message);
                });
    }

    private User user(String email, UserRole role) {
        return userRepository.save(new User("Pessoa", email, "unused", role, null));
    }

    private Fixture fixture(String prefix) {
        User owner = user(prefix + "-owner@example.com", UserRole.USER);
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(prefix, owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        return new Fixture(owner, calendar);
    }

    private record Fixture(User owner, SharedCalendar calendar) {
        UsernamePasswordAuthenticationToken auth() {
            return new UsernamePasswordAuthenticationToken(owner.getEmail(), null);
        }
    }
}

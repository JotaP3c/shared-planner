package com.sharedplanner.calendar;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class CalendarService {

    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AuthorizationService authorizationService;
    private final AuditService auditService;

    public CalendarService(
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository,
            AuthorizationService authorizationService,
            AuditService auditService
    ) {
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
    }

    @Transactional
    public CalendarResponse create(CreateCalendarRequest request, Authentication authentication) {
        authorizationService.ensureCanCreateCalendar(authentication);

        User currentUser = currentUser(authentication);

        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(request.name(), currentUser));
        memberRepository.save(new CalendarMember(calendar, currentUser, CalendarMemberRole.ADMIN, currentUser));

        auditService.log(
                AuditEntityType.CALENDAR,
                calendar.getId(),
                calendar.getId(),
                AuditAction.CREATED,
                "Calendar created: " + calendar.getName(),
                null,
                calendarSnapshot(calendar),
                currentUser
        );

        return CalendarResponse.from(calendar, CalendarMemberRole.ADMIN);
    }

    @Transactional(readOnly = true)
    public List<CalendarResponse> list(Authentication authentication) {
        User currentUser = currentUser(authentication);

        if (currentUser.getRole() == UserRole.ADMIN) {
            return calendarRepository.findAll()
                    .stream()
                    .map(CalendarResponse::fromSystemAdmin)
                    .toList();
        }

        return memberRepository.findByUserEmailIgnoreCase(currentUser.getEmail())
                .stream()
                .map(member -> CalendarResponse.from(member.getCalendar(), member.getRole()))
                .toList();
    }

    @Transactional
    public void addMember(UUID calendarId, AddCalendarMemberRequest request, Authentication authentication) {
        authorizationService.ensureCanManageCalendar(calendarId, authentication);

        User currentUser = currentUser(authentication);

        SharedCalendar calendar = calendarRepository.findById(calendarId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        User newMember = userRepository.findByEmailIgnoreCaseAndActiveTrue(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        CalendarMemberRole role = memberRole(request.role());

        memberRepository.findByCalendarIdAndUserId(calendarId, newMember.getId())
                .ifPresentOrElse(
                        member -> updateMemberRole(member, role, currentUser),
                        () -> addNewMember(calendar, newMember, role, currentUser)
                );
    }

    @Transactional(readOnly = true)
    public List<CalendarMemberResponse> listMembers(UUID calendarId, Authentication authentication) {
        authorizationService.ensureCalendarVisible(calendarId, authentication);
        return memberRepository.findByCalendarIdOrderByCreatedAtAsc(calendarId)
                .stream()
                .map(CalendarMemberResponse::from)
                .toList();
    }

    @Transactional
    public CalendarMemberResponse updateMember(UUID calendarId, UUID memberId,
            UpdateCalendarMemberRequest request, Authentication authentication) {
        authorizationService.ensureCanManageCalendar(calendarId, authentication);

        User currentUser = currentUser(authentication);

        CalendarMember member = memberRepository.findById(memberId)
                .filter(m -> m.getCalendar().getId().equals(calendarId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        String oldValue = memberSnapshot(member);
        member.changeRole(request.role(), currentUser);

        auditService.log(
                AuditEntityType.CALENDAR_MEMBER,
                member.getId(),
                calendarId,
                AuditAction.MEMBER_ROLE_UPDATED,
                "Calendar member role updated: " + member.getUser().getEmail(),
                oldValue,
                memberSnapshot(member),
                currentUser
        );

        return CalendarMemberResponse.from(member);
    }

    @Transactional
    public void removeMember(UUID calendarId, UUID memberId, Authentication authentication) {
        authorizationService.ensureCanManageCalendar(calendarId, authentication);

        User currentUser = currentUser(authentication);

        CalendarMember member = memberRepository.findById(memberId)
                .filter(m -> m.getCalendar().getId().equals(calendarId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        SharedCalendar calendar = calendarRepository.findById(calendarId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        if (calendar.getOwner().getId().equals(member.getUser().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove the calendar owner");
        }

        auditService.log(
                AuditEntityType.CALENDAR_MEMBER,
                member.getId(),
                calendarId,
                AuditAction.DELETED,
                "Calendar member removed: " + member.getUser().getEmail(),
                memberSnapshot(member),
                null,
                currentUser
        );

        memberRepository.delete(member);
    }

    private void updateMemberRole(CalendarMember member, CalendarMemberRole role, User currentUser) {
        String oldValue = memberSnapshot(member);

        member.changeRole(role, currentUser);

        auditService.log(
                AuditEntityType.CALENDAR_MEMBER,
                member.getId(),
                member.getCalendar().getId(),
                AuditAction.MEMBER_ROLE_UPDATED,
                "Calendar member role updated: " + member.getUser().getEmail(),
                oldValue,
                memberSnapshot(member),
                currentUser
        );
    }

    private void addNewMember(SharedCalendar calendar, User newMember, CalendarMemberRole role, User currentUser) {
        CalendarMember member = memberRepository.save(new CalendarMember(calendar, newMember, role, currentUser));

        auditService.log(
                AuditEntityType.CALENDAR_MEMBER,
                member.getId(),
                calendar.getId(),
                AuditAction.MEMBER_ADDED,
                "Calendar member added: " + newMember.getEmail(),
                null,
                memberSnapshot(member),
                currentUser
        );
    }

    private CalendarMemberRole memberRole(CalendarMemberRole role) {
        if (role == null) {
            return CalendarMemberRole.VIEWER;
        }

        return role;
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private String calendarSnapshot(SharedCalendar calendar) {
        return "name=" + calendar.getName()
                + "; ownerEmail=" + calendar.getOwner().getEmail();
    }

    private String memberSnapshot(CalendarMember member) {
        return "calendarId=" + member.getCalendar().getId()
                + "; userEmail=" + member.getUser().getEmail()
                + "; role=" + member.getRole();
    }
}

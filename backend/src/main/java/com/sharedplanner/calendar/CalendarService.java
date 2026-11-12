package com.sharedplanner.calendar;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Set;
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
        User currentUser = currentUser(authentication);
        CalendarType type = request.calendarType() == null ? CalendarType.SHARED : request.calendarType();
        if (type != CalendarType.SHARED && type != CalendarType.IMPORTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only shared or auxiliary imported calendars can be created explicitly");
        }
        User owner = currentUser;
        String ownerEmail = request.ownerEmail() == null ? "" : request.ownerEmail().trim().toLowerCase(Locale.ROOT);
        if (!ownerEmail.isBlank() && !ownerEmail.equalsIgnoreCase(currentUser.getEmail())) {
            // Resolve the account only after authorization, avoiding an account-existence oracle.
            authorizationService.ensureSystemAdmin(authentication);
            owner = userRepository.findByEmailIgnoreCase(ownerEmail)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar owner not found"));
            if (!Boolean.TRUE.equals(owner.getActive())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Calendar owner is inactive");
            }
        }

        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(request.name(), owner, type, currentUser));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, currentUser));

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

    /** Called in the user registration transaction; never moves legacy events. */
    @Transactional
    public SharedCalendar provisionPersonalCalendar(User owner) {
        return calendarRepository.findByOwnerIdAndCalendarType(owner.getId(), CalendarType.PERSONAL)
                .orElseGet(() -> {
                    String name = "Calendário de " + owner.getFullName();
                    SharedCalendar calendar = calendarRepository.save(new SharedCalendar(
                            name.substring(0, Math.min(120, name.length())), owner, CalendarType.PERSONAL));
                    memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
                    auditService.log(AuditEntityType.CALENDAR, calendar.getId(), calendar.getId(), AuditAction.CREATED,
                            "Personal calendar created", null, calendarSnapshot(calendar), owner);
                    return calendar;
                });
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
                .map(member -> CalendarResponse.from(member.getCalendar(), member.getRoles()))
                .toList();
    }

    @Transactional
    public void addMember(UUID calendarId, AddCalendarMemberRequest request, Authentication authentication) {
        authorizationService.ensureCanManageCalendar(calendarId, authentication);

        User currentUser = currentUser(authentication);

        SharedCalendar calendar = calendarRepository.findById(calendarId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        // Adicionar membro concede acesso a uma conta EXISTENTE; nunca cria contas.
        String email = request.email() == null ? "" : request.email().trim().toLowerCase(Locale.ROOT);

        User newMember = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!Boolean.TRUE.equals(newMember.getActive())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is inactive");
        }

        if (memberRepository.findByCalendarIdAndUserId(calendarId, newMember.getId()).isPresent()) {
            // Troca de papel é feita por PUT /members/{memberId}; o POST não sobrescreve vínculos.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a member of this calendar");
        }

        try {
            addNewMember(calendar, newMember, requestedRoles(request.role(), request.roles(), true), currentUser);
            memberRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            // Corrida entre duas adições simultâneas: a constraint única decide.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a member of this calendar");
        }
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
        Set<CalendarMemberRole> roles = requestedRoles(request.role(), request.roles(), false);
        ensureOwnerRemainsAdmin(member, roles);
        member.changeRoles(roles, currentUser);

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

    private void addNewMember(SharedCalendar calendar, User newMember, Set<CalendarMemberRole> roles, User currentUser) {
        CalendarMember member = new CalendarMember(calendar, newMember, CalendarMemberRole.VIEWER, currentUser);
        member.changeRoles(roles, currentUser);
        memberRepository.save(member);

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

    private Set<CalendarMemberRole> requestedRoles(CalendarMemberRole role, Set<CalendarMemberRole> roles, boolean allowDefault) {
        if (roles == null) {
            if (role != null) return Set.of(role);
            if (allowDefault) return Set.of(CalendarMemberRole.VIEWER);
        } else if (!roles.isEmpty() && roles.stream().noneMatch(java.util.Objects::isNull)) {
            return roles;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one calendar role is required");
    }

    private void ensureOwnerRemainsAdmin(CalendarMember member, Set<CalendarMemberRole> roles) {
        if (member.getCalendar().getOwner().getId().equals(member.getUser().getId())
                && !roles.contains(CalendarMemberRole.ADMIN)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Calendar owner must remain an ADMIN"
            );
        }
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
                + "; roles=" + member.getRoles();
    }
}

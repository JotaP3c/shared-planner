package com.sharedplanner.event;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.calendar.CalendarType;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.config.AuthorizationService.EventFinancialAccess;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AuthorizationService authorizationService;
    private final AuditService auditService;
    private final AppointmentConfirmationHistoryRepository confirmationHistoryRepository;

    public EventService(
            EventRepository eventRepository,
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository,
            AuthorizationService authorizationService,
            AuditService auditService,
            AppointmentConfirmationHistoryRepository confirmationHistoryRepository
    ) {
        this.eventRepository = eventRepository;
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.confirmationHistoryRepository = confirmationHistoryRepository;
    }

    @Transactional
    public EventResponse create(CreateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());
        String description = unifiedClientDescription(request.eventType(), request.workDescription(), request.description());
        String phone = normalizedClientPhone(request.eventType(), request.clientPhone());
        validateAllDay(request.allDay(), request.startsAt(), request.endsAt());
        validateEventFields(
                request.eventType(),
                request.clientName(),
                request.personName(),
                description,
                request.amount()
        );

        User currentUser = currentUser(authentication);
        SharedCalendar calendar = calendarRepository.findById(request.calendarId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        authorizationService.ensureCanCreateEvent(calendar.getId(), authentication);

        boolean multipleApproval = calendar.getCalendarType() == CalendarType.SHARED || request.approvalRequestedFromEmails() != null;
        List<User> approvers = multipleApproval ? approvalUsers(calendar, currentUser, request.eventType(),
                request.approvalRequestedFromEmails(), request.approvalRequestedFromEmail()) : List.of();
        User approvalRequestedFrom = multipleApproval ? null : approvalUser(
                request.eventType(),
                request.approvalRequestedFromEmail(),
                calendar.getId(),
                authentication.getName()
        );

        EventStatus status = request.eventType() == EventType.SHARED
                ? EventStatus.PENDING_APPROVAL
                : EventStatus.SCHEDULED;

        Event event = new Event(calendar, currentUser);
        event.fill(
                request.eventType(),
                status,
                request.title(),
                request.clientName(),
                request.personName(),
                request.eventType() == EventType.CLIENT ? description : request.description(),
                request.eventType() == EventType.CLIENT ? description : request.workDescription(),
                request.amount(),
                request.startsAt(),
                request.endsAt(),
                approvalRequestedFrom,
                currentUser
        );

        event.setClientPhone(phone);
        event.setAllDay(Boolean.TRUE.equals(request.allDay()));
        if (!approvers.isEmpty()) event.beginApprovalRound(approvers);

        Event savedEvent = eventRepository.save(event);

        auditService.log(
                AuditEntityType.EVENT,
                savedEvent.getId(),
                savedEvent.getCalendar().getId(),
                AuditAction.CREATED,
                "Event created: " + savedEvent.getTitle(),
                null,
                eventSnapshot(savedEvent),
                currentUser
        );

        return response(savedEvent, authentication);
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(UUID calendarId, LocalDateTime start, LocalDateTime end, Authentication authentication) {
        validatePeriod(start, end);
        authorizationService.ensureCalendarVisible(calendarId, authentication);
        EventFinancialAccess financialAccess = authorizationService
                .resolveEventFinancialAccess(calendarId, authentication);

        return eventRepository.findByCalendarIdAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(calendarId, end, start)
                .stream()
                .map(event -> response(event, financialAccess))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventSearchResponse> search(String term, Integer limit, Authentication authentication) {
        String normalizedTerm = term == null ? "" : term.trim();

        if (normalizedTerm.length() < 2) {
            return List.of();
        }

        int pageSize = limit == null ? 20 : limit;
        pageSize = Math.max(1, Math.min(pageSize, 50));

        Pageable pageable = PageRequest.of(0, pageSize);
        User currentUser = currentUser(authentication);

        List<Event> events;
        if (currentUser.getRole() == UserRole.ADMIN) {
            events = eventRepository.searchVisibleEventsForAdmin(
                    normalizedTerm,
                    EventStatus.CANCELLED,
                    pageable
            );
        } else {
            List<UUID> visibleCalendarIds = memberRepository.findByUserEmailIgnoreCase(currentUser.getEmail())
                    .stream()
                    .map(member -> member.getCalendar().getId())
                    .distinct()
                    .toList();

            if (visibleCalendarIds.isEmpty()) {
                return List.of();
            }

            events = eventRepository.searchVisibleEventsForMember(
                    visibleCalendarIds,
                    normalizedTerm,
                    EventStatus.CANCELLED,
                    pageable
            );
        }

        return events.stream()
                .map(EventSearchResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClientRevenueSummaryResponse summarizeClientRevenue(
            UUID calendarId,
            RevenuePeriod period,
            LocalDate referenceDate,
            Authentication authentication
    ) {
        if (period == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Revenue period is required");
        }

        LocalDate date = referenceDate == null ? LocalDate.now() : referenceDate;
        PeriodRange range = periodRange(period, date);

        authorizationService.ensureCanUseFinance(calendarId, authentication);

        ClientRevenueTotals totals = eventRepository.summarizeClientRevenue(
                calendarId,
                EventType.CLIENT,
                EventStatus.CANCELLED,
                range.start(),
                range.endExclusive()
        );

        BigDecimal totalAmount = totals == null || totals.getTotalAmount() == null
                ? BigDecimal.ZERO
                : totals.getTotalAmount();

        Long appointmentCount = totals == null || totals.getAppointmentCount() == null
                ? 0L
                : totals.getAppointmentCount();

        return new ClientRevenueSummaryResponse(
                calendarId,
                period,
                date,
                range.start(),
                range.endExclusive(),
                totalAmount,
                appointmentCount
        );
    }

    @Transactional(readOnly = true)
    public EventResponse findById(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        authorizationService.ensureCalendarVisible(event.getCalendar().getId(), authentication);

        return response(event, authentication);
    }

    @Transactional
    public EventResponse update(UUID eventId, UpdateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());
        String description = unifiedClientDescription(request.eventType(), request.workDescription(), request.description());
        String phone = normalizedClientPhone(request.eventType(), request.clientPhone());
        validateEventFields(
                request.eventType(),
                request.clientName(),
                request.personName(),
                description,
                request.amount()
        );

        Event event = mutableEvent(eventId);
        authorizationService.ensureCanEditEvent(event, authentication);
        ensureNotCancelled(event);
        validatePaymentIntegrityForUpdate(event, request);

        User currentUser = currentUser(authentication);
        String oldValue = eventSnapshot(event);

        validateAllDay(request.allDay() == null ? event.isAllDay() : request.allDay(), request.startsAt(), request.endsAt());
        boolean multipleApproval = event.getCalendar().getCalendarType() == CalendarType.SHARED
                || request.approvalRequestedFromEmails() != null || !event.getCurrentApprovals().isEmpty();
        List<String> requested = request.approvalRequestedFromEmails();
        if (requested == null && request.approvalRequestedFromEmail() == null
                && event.getCalendar().getCalendarType() != CalendarType.SHARED && !event.getCurrentApprovals().isEmpty()) {
            requested = event.getCurrentApprovals().stream().map(item -> item.getUser().getEmail()).toList();
        }
        List<User> approvers = multipleApproval ? approvalUsers(event.getCalendar(), event.getCreatedBy(), request.eventType(),
                requested, request.approvalRequestedFromEmail()) : List.of();
        User approvalRequestedFrom = multipleApproval ? null : approvalUserForUpdate(event, request, authentication);

        EventStatus status = request.eventType() == EventType.SHARED
                ? EventStatus.PENDING_APPROVAL
                : EventStatus.SCHEDULED;

        event.fill(
                request.eventType(),
                status,
                request.title(),
                request.clientName(),
                request.personName(),
                request.eventType() == EventType.CLIENT ? description : request.description(),
                request.eventType() == EventType.CLIENT ? description : request.workDescription(),
                request.amount(),
                request.startsAt(),
                request.endsAt(),
                approvalRequestedFrom,
                currentUser
        );

        event.setClientPhone(phone);
        if (request.allDay() != null) event.setAllDay(request.allDay());
        if (!approvers.isEmpty()) event.beginApprovalRound(approvers);
        else if (multipleApproval) event.finishApprovalRound();

        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.UPDATED,
                "Event updated: " + event.getTitle(),
                oldValue,
                eventSnapshot(event),
                currentUser
        );

        return response(event, authentication);
    }

    @Transactional
    public void delete(UUID eventId, Authentication authentication) {
        Event event = mutableEvent(eventId);
        authorizationService.ensureCanEditEvent(event, authentication);
        ensureNotCancelled(event);

        User currentUser = currentUser(authentication);
        String oldValue = eventSnapshot(event);

        event.cancel(currentUser);

        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.CANCELLED,
                "Event cancelled: " + event.getTitle(),
                oldValue,
                eventSnapshot(event),
                currentUser
        );
    }

    @Transactional
    public EventResponse approve(UUID eventId, Authentication authentication) {
        Event event = mutableEvent(eventId);
        User currentUser = currentUser(authentication);
        ensureApprovalTarget(event, currentUser);
        String oldValue = eventSnapshot(event);

        decideApproval(event, currentUser, true);

        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.APPROVED,
                "Event approved: " + event.getTitle(),
                oldValue,
                eventSnapshot(event),
                currentUser
        );

        return response(event, authentication);
    }

    @Transactional
    public EventResponse reject(UUID eventId, Authentication authentication) {
        Event event = mutableEvent(eventId);
        User currentUser = currentUser(authentication);
        ensureApprovalTarget(event, currentUser);
        String oldValue = eventSnapshot(event);

        decideApproval(event, currentUser, false);

        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.REJECTED,
                "Event rejected: " + event.getTitle(),
                oldValue,
                eventSnapshot(event),
                currentUser
        );

        return response(event, authentication);
    }

    @Transactional
    public EventResponse updatePayment(UUID eventId, UpdatePaymentRequest request, Authentication authentication) {
        Event event = mutableEvent(eventId);

        authorizationService.ensureCanEditEvent(event, authentication);
        ensureNotCancelled(event);
        User currentUser = currentUser(authentication);

        validatePayment(event, request);

        BigDecimal receivedAmount = request.receivedAmount() == null
                ? BigDecimal.ZERO
                : request.receivedAmount();

        LocalDateTime paidAt = request.paidAt();
        if ((request.paymentStatus() == PaymentStatus.PAID ||
                request.paymentStatus() == PaymentStatus.PARTIALLY_PAID) && paidAt == null) {
            paidAt = LocalDateTime.now();
        }

        String oldValue = paymentSnapshot(event);

        event.registerPayment(
                request.paymentStatus(),
                request.paymentMethod(),
                receivedAmount,
                paidAt,
                currentUser
        );

        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.PAYMENT_UPDATED,
                "Event payment updated: " + event.getTitle(),
                oldValue,
                paymentSnapshot(event),
                currentUser
        );

        return response(event, authentication);
    }

    /** PENDING_CONFIRMATION|RESCHEDULED → CONFIRMED. Confirmação ≠ pagamento. */
    @Transactional
    public EventResponse confirmAppointment(UUID eventId, Authentication authentication) {
        Event event = appointmentForConfirmationChange(eventId, authentication);
        AppointmentConfirmationStatus previous = event.effectiveConfirmationStatus();

        if (previous != AppointmentConfirmationStatus.PENDING_CONFIRMATION
                && previous != AppointmentConfirmationStatus.RESCHEDULED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Appointment cannot be confirmed from status " + previous
            );
        }

        User currentUser = currentUser(authentication);
        String oldValue = confirmationSnapshot(event);
        event.confirmAppointment(currentUser);

        recordConfirmationChange(event, previous, null, null, null, null, currentUser);
        auditService.log(
                AuditEntityType.EVENT,
                event.getId(),
                event.getCalendar().getId(),
                AuditAction.APPOINTMENT_CONFIRMED,
                "Appointment confirmed: " + event.getTitle(),
                oldValue,
                confirmationSnapshot(event),
                currentUser
        );

        return response(event, authentication);
    }

    /**
     * Desmarcação com motivo obrigatório. RESCHEDULE remarca o mesmo evento (nova data,
     * sem novo registro financeiro); GAVE_UP/OTHER deixam o atendimento CANCELLED sem
     * apagar ou estornar pagamentos existentes.
     */
    @Transactional
    public EventResponse unscheduleAppointment(
            UUID eventId,
            UnscheduleAppointmentRequest request,
            Authentication authentication
    ) {
        if (request == null || request.reason() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unschedule reason is required");
        }

        Event event = appointmentForConfirmationChange(eventId, authentication);
        AppointmentConfirmationStatus previous = event.effectiveConfirmationStatus();

        if (previous == AppointmentConfirmationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Appointment is already unscheduled");
        }

        String notes = request.notes() == null || request.notes().isBlank() ? null : request.notes().trim();

        if (request.reason() == UnscheduleReason.OTHER && notes == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes are required when reason is OTHER");
        }

        User currentUser = currentUser(authentication);
        String oldValue = confirmationSnapshot(event);
        LocalDateTime previousStartsAt = event.getStartsAt();
        LocalDateTime previousEndsAt = event.getEndsAt();

        if (request.reason() == UnscheduleReason.RESCHEDULE) {
            if (request.newStartsAt() == null || request.newEndsAt() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reschedule requires newStartsAt and newEndsAt");
            }

            validatePeriod(request.newStartsAt(), request.newEndsAt());

            if (request.newStartsAt().equals(previousStartsAt) && request.newEndsAt().equals(previousEndsAt)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reschedule requires a different date or time");
            }

            event.rescheduleAppointment(request.newStartsAt(), request.newEndsAt(), notes, currentUser);
            recordConfirmationChange(event, previous, UnscheduleReason.RESCHEDULE, notes,
                    previousStartsAt, previousEndsAt, currentUser);
            auditService.log(
                    AuditEntityType.EVENT,
                    event.getId(),
                    event.getCalendar().getId(),
                    AuditAction.APPOINTMENT_RESCHEDULED,
                    "Appointment rescheduled: " + event.getTitle(),
                    oldValue,
                    confirmationSnapshot(event),
                    currentUser
            );
        } else {
            event.unscheduleAppointment(request.reason(), notes, currentUser);
            recordConfirmationChange(event, previous, request.reason(), notes, null, null, currentUser);
            auditService.log(
                    AuditEntityType.EVENT,
                    event.getId(),
                    event.getCalendar().getId(),
                    AuditAction.APPOINTMENT_UNSCHEDULED,
                    "Appointment unscheduled: " + event.getTitle(),
                    oldValue,
                    confirmationSnapshot(event),
                    currentUser
            );
        }

        return response(event, authentication);
    }

    @Transactional(readOnly = true)
    public List<ConfirmationHistoryResponse> confirmationHistory(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        authorizationService.ensureCalendarVisible(event.getCalendar().getId(), authentication);

        return confirmationHistoryRepository.findByEventIdOrderByPerformedAtDesc(eventId)
                .stream()
                .map(ConfirmationHistoryResponse::from)
                .toList();
    }

    private Event appointmentForConfirmationChange(UUID eventId, Authentication authentication) {
        Event event = mutableEvent(eventId);
        authorizationService.ensureCanEditEvent(event, authentication);
        ensureNotCancelled(event);

        if (event.getEventType() != EventType.CLIENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only client events have appointment confirmation");
        }

        return event;
    }

    private void recordConfirmationChange(
            Event event,
            AppointmentConfirmationStatus previous,
            UnscheduleReason reason,
            String notes,
            LocalDateTime previousStartsAt,
            LocalDateTime previousEndsAt,
            User performedBy
    ) {
        boolean rescheduled = reason == UnscheduleReason.RESCHEDULE;
        confirmationHistoryRepository.save(new AppointmentConfirmationHistory(
                event,
                previous,
                event.getConfirmationStatus(),
                reason,
                notes,
                previousStartsAt,
                previousEndsAt,
                rescheduled ? event.getStartsAt() : null,
                rescheduled ? event.getEndsAt() : null,
                performedBy
        ));
    }

    private String confirmationSnapshot(Event event) {
        return "confirmationStatus=" + event.effectiveConfirmationStatus()
                + "; unscheduleReason=" + event.getUnscheduleReason()
                + "; rescheduleCount=" + event.getRescheduleCount()
                + "; startsAt=" + event.getStartsAt()
                + "; endsAt=" + event.getEndsAt();
    }

    @Transactional(readOnly = true)
    public List<EventResponse> listPendingApprovals(Authentication authentication) {
        User currentUser = currentUser(authentication);

        List<Event> events;
        if (currentUser.getRole() == UserRole.ADMIN) {
            events = eventRepository.findByStatusOrderByStartsAtAsc(EventStatus.PENDING_APPROVAL);
        } else {
            events = eventRepository.findPendingApprovalsForCurrentMember(
                    EventStatus.PENDING_APPROVAL,
                    currentUser.getEmail(),
                    currentUser.getId()
            );
        }

        Map<UUID, EventFinancialAccess> financialAccessByCalendar = new HashMap<>();

        return events.stream()
                .map(event -> response(
                        event,
                        financialAccessByCalendar.computeIfAbsent(
                                event.getCalendar().getId(),
                                calendarId -> authorizationService.resolveEventFinancialAccess(calendarId, authentication)
                        )
                ))
                .toList();
    }

    private Event event(UUID eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    private Event mutableEvent(UUID eventId) {
        return eventRepository.findForUpdate(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    @Transactional(readOnly = true)
    public List<EventApprovalResponse> approvalHistory(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        authorizationService.ensureCalendarVisible(event.getCalendar().getId(), authentication);
        return event.getApprovalHistory().stream().map(EventApprovalResponse::from).toList();
    }

    private void decideApproval(Event event, User user, boolean approved) {
        if (event.getCurrentApprovals().isEmpty()) {
            if (approved) event.approve(user); else event.reject(user);
            return;
        }
        event.getCurrentApprovals().stream().filter(item -> item.getUser().getId().equals(user.getId()))
                .findFirst().orElseThrow().respond(approved);
        if (!approved) event.reject(user);
        else if (event.getCurrentApprovals().stream().allMatch(item -> item.getStatus() == EventApprovalStatus.APPROVED)) event.approve(user);
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void ensureCalendarMember(UUID calendarId, String email) {
        memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));
    }

    private void ensureApprovalTarget(Event event, User currentUser) {
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event is not pending approval");
        }

        boolean designated = event.getCurrentApprovals().isEmpty()
                ? event.getApprovalRequestedFrom() != null && event.getApprovalRequestedFrom().getId().equals(currentUser.getId())
                : event.getCurrentApprovals().stream().anyMatch(item -> item.getUser().getId().equals(currentUser.getId())
                        && item.getStatus() == EventApprovalStatus.PENDING);
        if (!designated) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This event is not waiting for your approval");
        }

        if (!memberRepository.existsByCalendarIdAndUserId(
                event.getCalendar().getId(), currentUser.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Approval target is no longer a calendar member"
            );
        }
    }

    private User approvalUser(EventType eventType, String email, UUID calendarId, String currentUserEmail) {
        if (eventType != EventType.SHARED) {
            return null;
        }

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shared events require approvalRequestedFromEmail");
        }

        if (email.equalsIgnoreCase(currentUserEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shared events require another user approval");
        }

        ensureCalendarMember(calendarId, email);

        return userRepository.findByEmailIgnoreCaseAndActiveTrue(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approval user not found"));
    }

    private List<User> approvalUsers(SharedCalendar calendar, User creator, EventType type,
            List<String> requestedEmails, String legacyEmail) {
        if (calendar.getCalendarType() != CalendarType.SHARED && type != EventType.SHARED) return List.of();
        List<String> emails = requestedEmails;
        if (emails == null && legacyEmail != null && !legacyEmail.isBlank()) emails = List.of(legacyEmail);
        if (emails == null && calendar.getCalendarType() == CalendarType.SHARED) {
            emails = memberRepository.findByCalendarIdOrderByCreatedAtAsc(calendar.getId()).stream()
                    .map(member -> member.getUser()).filter(user -> Boolean.TRUE.equals(user.getActive()))
                    .filter(user -> !user.getId().equals(creator.getId())).map(User::getEmail).toList();
        }
        if (emails == null || emails.isEmpty() || emails.size() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one other active calendar member must approve the event");
        }
        Map<UUID, User> users = new LinkedHashMap<>();
        for (String email : emails) {
            if (email == null || email.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Approval email is required");
            User user = userRepository.findByEmailIgnoreCaseAndActiveTrue(email.trim().toLowerCase(Locale.ROOT))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approval user not found"));
            if (user.getId().equals(creator.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event creator cannot approve their own event");
            requireEligibleInheritedApprover(user, calendar.getId());
            users.put(user.getId(), user);
        }
        return new ArrayList<>(users.values());
    }

    private String unifiedClientDescription(EventType type, String work, String notes) {
        if (type != EventType.CLIENT) return work;
        String service = work == null ? "" : work.trim();
        String description = notes == null ? "" : notes.trim();
        return service.isEmpty() ? description : description.isEmpty() || service.equals(description)
                ? service : service + "\n\n" + description;
    }

    private String normalizedClientPhone(EventType type, String phone) {
        if (type != EventType.CLIENT || phone == null || phone.isBlank()) return null;
        if (!phone.matches("[+0-9() \\-]+")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Brazilian mobile phone");
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 13 && digits.startsWith("55")) digits = digits.substring(2);
        if (!digits.matches("[1-9][0-9]9[0-9]{8}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brazilian mobile phone must contain area code and 9 digits");
        return digits;
    }

    private void validateAllDay(Boolean allDay, LocalDateTime start, LocalDateTime end) {
        if (Boolean.TRUE.equals(allDay) && (!start.toLocalTime().equals(java.time.LocalTime.MIDNIGHT)
                || !end.toLocalTime().equals(java.time.LocalTime.MIDNIGHT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All-day events require midnight boundaries and exclusive end date");
        }
    }

    private User approvalUserForUpdate(Event event, UpdateEventRequest request, Authentication authentication) {
        if (request.eventType() != EventType.SHARED) {
            return null;
        }

        String currentUserEmail = authentication.getName();

        if (request.approvalRequestedFromEmail() != null && !request.approvalRequestedFromEmail().isBlank()) {
            return approvalUser(
                    request.eventType(),
                    request.approvalRequestedFromEmail(),
                    event.getCalendar().getId(),
                    currentUserEmail
            );
        }

        if (!event.getCreatedBy().getEmail().equalsIgnoreCase(currentUserEmail)) {
            return requireEligibleInheritedApprover(event.getCreatedBy(), event.getCalendar().getId());
        }

        if (event.getApprovalRequestedFrom() != null
                && !event.getApprovalRequestedFrom().getEmail().equalsIgnoreCase(currentUserEmail)) {
            return requireEligibleInheritedApprover(event.getApprovalRequestedFrom(), event.getCalendar().getId());
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shared events require approvalRequestedFromEmail");
    }

    /**
     * BR-SHARED-001/004: o aprovador herdado ao reabrir um SHARED precisa continuar
     * ativo e membro atual do calendário; caso contrário o evento ficaria preso em
     * PENDING_APPROVAL para alguém que nunca poderá decidir.
     */
    private User requireEligibleInheritedApprover(User candidate, UUID calendarId) {
        if (!Boolean.TRUE.equals(candidate.getActive())
                || !memberRepository.existsByCalendarIdAndUserId(calendarId, candidate.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Shared event approver is no longer an active calendar member; inform approvalRequestedFromEmail"
            );
        }

        return candidate;
    }

    private void validatePeriod(LocalDateTime startsAt, LocalDateTime endsAt) {
        if (startsAt == null || endsAt == null || !endsAt.isAfter(startsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event end must be after start");
        }
    }

    private void ensureNotCancelled(Event event) {
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cancelled events cannot be changed");
        }
    }

    private void validatePaymentIntegrityForUpdate(Event event, UpdateEventRequest request) {
        if (event.getEventType() != EventType.CLIENT
                || event.getPaymentStatus() == PaymentStatus.PENDING) {
            return;
        }

        if (request.eventType() != EventType.CLIENT) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client events with payment history cannot change type"
            );
        }

        if (event.getAmount() == null
                || request.amount() == null
                || event.getAmount().compareTo(request.amount()) != 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Client events with payment history cannot change amount"
            );
        }
    }

    private void validateEventFields(
            EventType eventType,
            String clientName,
            String personName,
            String workDescription,
            BigDecimal amount
    ) {
        if (eventType == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event type is required");
        }

        if (amount != null && amount.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be zero or positive");
        }

        if (eventType == EventType.CLIENT) {
            requireText(clientName, "Client events require clientName");
            requireText(workDescription, "Client events require workDescription");

            if (amount == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Client events require amount");
            }
        }

        if (eventType == EventType.PERSONAL) {
            requireText(personName, "Personal events require personName");
        }
    }

    private void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private PeriodRange periodRange(RevenuePeriod period, LocalDate referenceDate) {
        return switch (period) {
            case DAILY -> new PeriodRange(referenceDate.atStartOfDay(), referenceDate.plusDays(1).atStartOfDay());
            case WEEKLY -> weeklyRange(referenceDate);
            case BIWEEKLY -> biweeklyRange(referenceDate);
            case MONTHLY -> new PeriodRange(
                    referenceDate.withDayOfMonth(1).atStartOfDay(),
                    referenceDate.withDayOfMonth(1).plusMonths(1).atStartOfDay()
            );
        };
    }

    private PeriodRange weeklyRange(LocalDate referenceDate) {
        LocalDate start = referenceDate;
        while (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            start = start.minusDays(1);
        }

        return new PeriodRange(start.atStartOfDay(), start.plusWeeks(1).atStartOfDay());
    }

    private PeriodRange biweeklyRange(LocalDate referenceDate) {
        LocalDate monthStart = referenceDate.withDayOfMonth(1);

        if (referenceDate.getDayOfMonth() <= 15) {
            return new PeriodRange(monthStart.atStartOfDay(), monthStart.withDayOfMonth(16).atStartOfDay());
        }

        LocalDate secondHalfStart = monthStart.withDayOfMonth(16);
        return new PeriodRange(secondHalfStart.atStartOfDay(), monthStart.plusMonths(1).atStartOfDay());
    }

    private void validatePayment(Event event, UpdatePaymentRequest request) {
        if (request.paymentStatus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment status is required");
        }

        if (event.getEventType() != EventType.CLIENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only client events can have payments");
        }

        BigDecimal receivedAmount = request.receivedAmount() == null
                ? BigDecimal.ZERO
                : request.receivedAmount();

        if (receivedAmount.compareTo(event.getAmount()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Received amount cannot be greater than event amount");
        }

        if (request.paymentStatus() == PaymentStatus.PENDING && receivedAmount.signum() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pending payments cannot have received amount");
        }

        if (request.paymentStatus() == PaymentStatus.PENDING && request.paidAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pending payments cannot have paidAt");
        }

        if (request.paymentStatus() == PaymentStatus.PARTIALLY_PAID &&
                (receivedAmount.signum() <= 0 || receivedAmount.compareTo(event.getAmount()) >= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Partially paid events require received amount lower than event amount");
        }

        if ((request.paymentStatus() == PaymentStatus.PARTIALLY_PAID ||
                request.paymentStatus() == PaymentStatus.PAID) && request.paymentMethod() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paid payments require paymentMethod");
        }

        if (request.paymentStatus() == PaymentStatus.PAID &&
                receivedAmount.compareTo(event.getAmount()) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paid events require received amount equal to event amount");
        }

        if (request.paymentStatus() == PaymentStatus.REFUNDED && receivedAmount.signum() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refunded payments cannot have received amount");
        }
    }

    private String eventSnapshot(Event event) {
        return "title=" + event.getTitle()
                + "; eventType=" + event.getEventType()
                + "; status=" + event.getStatus()
                + "; clientName=" + event.getClientName()
                + "; personName=" + event.getPersonName()
                + "; amount=" + event.getAmount()
                + "; startsAt=" + event.getStartsAt()
                + "; endsAt=" + event.getEndsAt()
                + "; paymentStatus=" + event.getPaymentStatus()
                + "; paymentMethod=" + event.getPaymentMethod()
                + "; receivedAmount=" + event.getReceivedAmount()
                + "; confirmationStatus=" + event.effectiveConfirmationStatus();
    }

    private String paymentSnapshot(Event event) {
        return "paymentStatus=" + event.getPaymentStatus()
                + "; paymentMethod=" + event.getPaymentMethod()
                + "; receivedAmount=" + event.getReceivedAmount()
                + "; paidAt=" + event.getPaidAt();
    }

    private EventResponse response(Event event, Authentication authentication) {
        EventFinancialAccess financialAccess = authorizationService.resolveEventFinancialAccess(
                event.getCalendar().getId(),
                authentication
        );
        return response(event, financialAccess);
    }

    private EventResponse response(Event event, EventFinancialAccess financialAccess) {
        return EventResponse.from(event, financialAccess.canView(event));
    }

    private record PeriodRange(LocalDateTime start, LocalDateTime endExclusive) {
    }
}

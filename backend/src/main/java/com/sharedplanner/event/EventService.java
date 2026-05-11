package com.sharedplanner.event;

import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.sharedplanner.config.AuthorizationService;


@Service
public class EventService {

    private final EventRepository eventRepository;
    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AuthorizationService authorizationService;

    public EventService(
            EventRepository eventRepository,
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository,
            AuthorizationService authorizationService
    ) {
        this.eventRepository = eventRepository;
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public EventResponse create(CreateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());
        validateEventFields(
                request.eventType(),
                request.clientName(),
                request.personName(),
                request.workDescription(),
                request.amount()
        );

        User currentUser = currentUser(authentication);
        SharedCalendar calendar = calendarRepository.findById(request.calendarId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        authorizationService.ensureCanCreateEvent(calendar.getId(), authentication);

        User approvalRequestedFrom = approvalUser(request.eventType(), request.approvalRequestedFromEmail(), calendar.getId(), authentication.getName());
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
                request.description(),
                request.workDescription(),
                request.amount(),
                request.startsAt(),
                request.endsAt(),
                approvalRequestedFrom
        );

        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(UUID calendarId, LocalDateTime start, LocalDateTime end, Authentication authentication) {
        validatePeriod(start, end);
        authorizationService.ensureCalendarVisible(calendarId, authentication);

        return eventRepository.findByCalendarIdAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(calendarId, end, start)
                .stream()
                .map(EventResponse::from)
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

        authorizationService.ensureCalendarVisible(calendarId, authentication);

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

        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse update(UUID eventId, UpdateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());
        validateEventFields(
                request.eventType(),
                request.clientName(),
                request.personName(),
                request.workDescription(),
                request.amount()
        );

        Event event = event(eventId);
        authorizationService.ensureCanEditEvent(event, authentication);

        User approvalRequestedFrom = approvalUser(request.eventType(), request.approvalRequestedFromEmail(), event.getCalendar().getId(), authentication.getName());
        EventStatus status = request.eventType() == EventType.SHARED
                ? EventStatus.PENDING_APPROVAL
                : EventStatus.SCHEDULED;

        event.fill(
                request.eventType(),
                status,
                request.title(),
                request.clientName(),
                request.personName(),
                request.description(),
                request.workDescription(),
                request.amount(),
                request.startsAt(),
                request.endsAt(),
                approvalRequestedFrom
        );

        return EventResponse.from(event);
    }

    @Transactional
    public void delete(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        authorizationService.ensureCanEditEvent(event, authentication);

        eventRepository.delete(event);
    }

    @Transactional
    public EventResponse approve(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        ensureApprovalTarget(event, authentication.getName());

        event.approve(currentUser(authentication));

        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse reject(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        ensureApprovalTarget(event, authentication.getName());

        event.reject();

        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse updatePayment(UUID eventId, UpdatePaymentRequest request, Authentication authentication) {
        Event event = event(eventId);

        authorizationService.ensureCanEditEvent(event, authentication);

        validatePayment(event, request);

        BigDecimal receivedAmount = request.receivedAmount() == null
                ? BigDecimal.ZERO
                : request.receivedAmount();

        LocalDateTime paidAt = request.paidAt();
        if ((request.paymentStatus() == PaymentStatus.PAID ||
                request.paymentStatus() == PaymentStatus.PARTIALLY_PAID) && paidAt == null) {
            paidAt = LocalDateTime.now();
        }

        event.registerPayment(
                request.paymentStatus(),
                request.paymentMethod(),
                receivedAmount,
                paidAt
        );

        return EventResponse.from(event);
    }

    private Event event(UUID eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void ensureCalendarMember(UUID calendarId, String email) {
        memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));
    }

    private void ensureCreatedByCurrentUser(Event event, String email) {
        if (!event.getCreatedBy().getEmail().equalsIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only event creator can change this event");
        }
    }

    private void ensureApprovalTarget(Event event, String email) {
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event is not pending approval");
        }

        if (event.getApprovalRequestedFrom() == null ||
                !event.getApprovalRequestedFrom().getEmail().equalsIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This event is not waiting for your approval");
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

    private void validatePeriod(LocalDateTime startsAt, LocalDateTime endsAt) {
        if (startsAt == null || endsAt == null || !endsAt.isAfter(startsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event end must be after start");
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

    private record PeriodRange(LocalDateTime start, LocalDateTime endExclusive) {
    }
}

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

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;

    public EventService(
            EventRepository eventRepository,
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository
    ) {
        this.eventRepository = eventRepository;
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public EventResponse create(CreateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());

        User currentUser = currentUser(authentication);
        SharedCalendar calendar = calendarRepository.findById(request.calendarId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        ensureCalendarMember(calendar.getId(), authentication.getName());

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
        ensureCalendarMember(calendarId, authentication.getName());

        return eventRepository.findByCalendarIdAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(calendarId, end, start)
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EventResponse findById(UUID eventId, Authentication authentication) {
        Event event = event(eventId);
        ensureCalendarMember(event.getCalendar().getId(), authentication.getName());

        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse update(UUID eventId, UpdateEventRequest request, Authentication authentication) {
        validatePeriod(request.startsAt(), request.endsAt());

        Event event = event(eventId);
        ensureCalendarMember(event.getCalendar().getId(), authentication.getName());
        ensureCreatedByCurrentUser(event, authentication.getName());

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
        ensureCalendarMember(event.getCalendar().getId(), authentication.getName());
        ensureCreatedByCurrentUser(event, authentication.getName());

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
}

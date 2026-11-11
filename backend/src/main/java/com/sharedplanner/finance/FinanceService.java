package com.sharedplanner.finance;

import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.AppointmentConfirmationStatus;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FinanceService {

    /** Até 62 dias a evolução é diária; acima disso, mensal. */
    static final long DAILY_GRANULARITY_MAX_DAYS = 62;
    /** Limite defensivo para consultas de evolução (≈ 3 anos). */
    static final long TIMELINE_MAX_DAYS = 1100;
    private static final int DEFAULT_APPOINTMENT_LIMIT = 10;
    private static final int MAX_APPOINTMENT_LIMIT = 50;

    private final EventRepository eventRepository;
    private final AuthorizationService authorizationService;

    public FinanceService(
            EventRepository eventRepository,
            AuthorizationService authorizationService
    ) {
        this.eventRepository = eventRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional(readOnly = true)
    public FinanceSummaryResponse summarize(
            UUID calendarId,
            LocalDate startDate,
            LocalDate endDate,
            Authentication authentication
    ) {
        validatePeriod(startDate, endDate);
        authorizationService.ensureCanUseFinance(calendarId, authentication);

        FinanceTotals totals = eventRepository.summarizeFinance(
                calendarId,
                startDate.atStartOfDay(),
                endDate.plusDays(1).atStartOfDay()
        );

        return new FinanceSummaryResponse(
                calendarId,
                startDate,
                endDate,
                safeAmount(totals.getExpectedAmount()),
                safeAmount(totals.getReceivedAmount()),
                safeAmount(totals.getPendingAmount()),
                safeCount(totals.getAppointmentCount()),
                safeCount(totals.getPaidCount()),
                safeCount(totals.getPendingCount()),
                safeCount(totals.getPartiallyPaidCount()),
                safeCount(totals.getRefundedCount()),
                safeAmount(totals.getConfirmedAmount()),
                safeAmount(totals.getUnconfirmedAmount()),
                safeAmount(totals.getUnscheduledAmount()),
                safeCount(totals.getConfirmedCount()),
                safeCount(totals.getAwaitingConfirmationCount()),
                safeCount(totals.getRescheduledCount()),
                safeCount(totals.getUnscheduledCount()),
                safeCount(totals.getRescheduleOccurrences())
        );
    }

    @Transactional(readOnly = true)
    public FinanceTimelineResponse timeline(
            UUID calendarId,
            LocalDate startDate,
            LocalDate endDate,
            Authentication authentication
    ) {
        validatePeriod(startDate, endDate);
        long days = ChronoUnit.DAYS.between(startDate, endDate) + 1;

        if (days > TIMELINE_MAX_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Timeline period must not exceed 1100 days");
        }

        authorizationService.ensureCanUseFinance(calendarId, authentication);

        FinanceTimelineResponse.Granularity granularity = days <= DAILY_GRANULARITY_MAX_DAYS
                ? FinanceTimelineResponse.Granularity.DAY
                : FinanceTimelineResponse.Granularity.MONTH;

        Map<LocalDate, Bucket> buckets = new LinkedHashMap<>();
        LocalDate cursor = bucketKey(startDate, granularity);
        while (!cursor.isAfter(endDate)) {
            buckets.put(cursor, new Bucket());
            cursor = granularity == FinanceTimelineResponse.Granularity.DAY ? cursor.plusDays(1) : cursor.plusMonths(1);
        }

        for (Event event : financeEvents(calendarId, startDate, endDate, Pageable.unpaged())) {
            Bucket bucket = buckets.get(bucketKey(event.getStartsAt().toLocalDate(), granularity));

            if (bucket == null) {
                continue;
            }

            bucket.appointmentCount++;
            bucket.received = bucket.received.add(safeAmount(event.getReceivedAmount()));

            if (event.effectiveConfirmationStatus() != AppointmentConfirmationStatus.CANCELLED) {
                bucket.expected = bucket.expected.add(safeAmount(event.getAmount()));
            }
        }

        List<FinanceTimelineResponse.Point> points = new ArrayList<>();
        buckets.forEach((date, bucket) -> points.add(new FinanceTimelineResponse.Point(
                date,
                bucket.expected,
                bucket.received,
                bucket.appointmentCount
        )));

        return new FinanceTimelineResponse(calendarId, startDate, endDate, granularity, points);
    }

    @Transactional(readOnly = true)
    public List<FinanceAppointmentResponse> appointments(
            UUID calendarId,
            LocalDate startDate,
            LocalDate endDate,
            Integer limit,
            Authentication authentication
    ) {
        validatePeriod(startDate, endDate);
        int pageSize = normalizeLimit(limit);
        authorizationService.ensureCanUseFinance(calendarId, authentication);

        return financeEvents(calendarId, startDate, endDate, PageRequest.of(0, pageSize))
                .stream()
                .map(event -> new FinanceAppointmentResponse(
                        event.getId(),
                        event.getCalendar().getId(),
                        event.getStartsAt(),
                        event.getClientName(),
                        event.getWorkDescription(),
                        safeAmount(event.getAmount()),
                        safeAmount(event.getReceivedAmount()),
                        event.getPaymentStatus(),
                        event.effectiveConfirmationStatus()
                ))
                .toList();
    }

    private List<Event> financeEvents(UUID calendarId, LocalDate startDate, LocalDate endDate, Pageable pageable) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();
        return eventRepository.findFinanceEvents(calendarId, start, endExclusive, pageable);
    }

    private LocalDate bucketKey(LocalDate date, FinanceTimelineResponse.Granularity granularity) {
        return granularity == FinanceTimelineResponse.Granularity.DAY ? date : date.withDayOfMonth(1);
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_APPOINTMENT_LIMIT;
        }

        if (limit <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be greater than zero");
        }

        return Math.min(limit, MAX_APPOINTMENT_LIMIT);
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date and end date are required");
        }

        if (endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be equal to or after start date");
        }
    }

    private BigDecimal safeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Long safeCount(Long value) {
        return value == null ? 0L : value;
    }

    private static final class Bucket {
        private BigDecimal expected = BigDecimal.ZERO;
        private BigDecimal received = BigDecimal.ZERO;
        private long appointmentCount;
    }
}

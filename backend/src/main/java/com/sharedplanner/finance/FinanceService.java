package com.sharedplanner.finance;

import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.event.EventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import com.sharedplanner.config.AuthorizationService;

@Service
public class FinanceService {

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

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();

        FinanceTotals totals = eventRepository.summarizeFinance(calendarId, start, endExclusive);

        BigDecimal expectedAmount = safeAmount(totals.getExpectedAmount());
        BigDecimal receivedAmount = safeAmount(totals.getReceivedAmount());
        BigDecimal pendingAmount = expectedAmount.subtract(receivedAmount);

        return new FinanceSummaryResponse(
                calendarId,
                startDate,
                endDate,
                expectedAmount,
                receivedAmount,
                pendingAmount,
                safeCount(totals.getAppointmentCount()),
                safeCount(totals.getPaidCount()),
                safeCount(totals.getPendingCount()),
                safeCount(totals.getPartiallyPaidCount()),
                safeCount(totals.getRefundedCount())
        );
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
}

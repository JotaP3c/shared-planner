package com.sharedplanner.finance;

import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.Event;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
public class FinanceExportService {
    static final int MAX_CALENDARS = 20;
    static final int MAX_APPOINTMENTS = 10_000;
    static final int MAX_TEXT_CHARACTERS = 2_000_000;

    private final AuthorizationService authorization;
    private final SharedCalendarRepository calendars;
    private final FinanceExportEventRepository events;
    private final FinanceService finance;

    public FinanceExportService(AuthorizationService authorization, SharedCalendarRepository calendars,
                                FinanceExportEventRepository events, FinanceService finance) {
        this.authorization = authorization;
        this.calendars = calendars;
        this.events = events;
        this.finance = finance;
    }

    /** One database snapshot for all worksheets; never silently truncate a report. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ExportFile export(List<UUID> calendarIds, LocalDate startDate, LocalDate endDate,
                             Authentication authentication) {
        List<UUID> uniqueIds = validate(calendarIds, startDate, endDate);
        // Check the entire selection before reading even the first calendar's financial data.
        for (UUID id : uniqueIds) {
            authorization.ensureCanExportFinance(id, authentication);
        }
        var budget = events.budget(uniqueIds, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());
        if (budget.getAppointmentCount() > MAX_APPOINTMENTS || budget.getTextCharacters() > MAX_TEXT_CHARACTERS
                || budget.getLongestService() > 32767) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "The report exceeds 10000 appointments, 2000000 text characters or Excel's 32767-character cell limit; select a smaller report");
        }
        List<Event> appointments = events.findExportEvents(uniqueIds, startDate.atStartOfDay(),
                endDate.plusDays(1).atStartOfDay(), PageRequest.of(0, MAX_APPOINTMENTS + 1));
        if (appointments.size() > MAX_APPOINTMENTS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "The report exceeds 10000 appointments; select a smaller period or fewer calendars");
        }
        validateAppointmentText(appointments);
        List<FinanceWorkbook.CalendarData> data = new ArrayList<>();
        for (UUID id : uniqueIds) {
            SharedCalendar calendar = calendars.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));
            validateCellText(calendar.getName());
            data.add(new FinanceWorkbook.CalendarData(id, calendar.getName(),
                    finance.summarize(id, startDate, endDate, authentication),
                    finance.timeline(id, startDate, endDate, authentication)));
        }
        validateCellText("Calendários: " + String.join(", ", data.stream().map(FinanceWorkbook.CalendarData::name).toList()));
        try {
            byte[] content = new FinanceWorkbook().write(startDate, endDate, data, appointments);
            return new ExportFile(fileName(startDate, endDate), content);
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate financial report", error);
        }
    }

    /** PostgreSQL length() counts code points; Excel/POI's limit uses UTF-16 units. */
    private void validateAppointmentText(List<Event> appointments) {
        long characters = 0;
        for (Event event : appointments) {
            characters += validateCellText(event.getWorkDescription());
            characters += validateCellText(event.getClientName());
            characters += validateCellText(event.getCalendar().getName());
            validateCellText(event.getExternalSource());
        }
        if (characters > MAX_TEXT_CHARACTERS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "The report exceeds 2000000 UTF-16 text characters; select a smaller report");
        }
    }

    private int validateCellText(String value) {
        int characters = value == null ? 0 : value.length();
        if (characters > FinanceWorkbook.MAX_CELL_CHARACTERS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "The report contains text exceeding Excel's 32767 UTF-16 character cell limit; select a smaller report");
        }
        return characters;
    }

    private List<UUID> validate(List<UUID> ids, LocalDate startDate, LocalDate endDate) {
        if (ids == null || ids.isEmpty() || ids.size() > 100 || ids.stream().anyMatch(id -> id == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at least one valid calendar");
        }
        List<UUID> uniqueIds = new ArrayList<>(new LinkedHashSet<>(ids));
        if (uniqueIds.size() > MAX_CALENDARS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at most 20 calendars per export");
        }
        if (startDate == null || endDate == null || endDate.isBefore(startDate)
                || startDate.isBefore(LocalDate.of(1900, 1, 1))
                || endDate.isAfter(LocalDate.of(9999, 12, 30))
                || ChronoUnit.DAYS.between(startDate, endDate) + 1 > FinanceService.TIMELINE_MAX_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a valid inclusive period of at most 1100 days, between 1900 and 9999");
        }
        return uniqueIds;
    }

    private String fileName(LocalDate start, LocalDate end) {
        String period = start.getDayOfMonth() == 1 && end.equals(start.withDayOfMonth(start.lengthOfMonth()))
                ? start.format(DateTimeFormatter.ofPattern("yyyy-MM"))
                : start + "_" + end;
        return "shared-planner-financial-report-" + period + ".xlsx";
    }

    public record ExportFile(String filename, byte[] content) {}
}

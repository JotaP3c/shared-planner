package com.sharedplanner.holiday;

import java.time.LocalDate;
import java.util.List;

/** Read-only overlay, deliberately separate from appointments and financial events. */
public record HolidayCalendarResponse(
        String calendarId, String calendarName, String country, int year,
        List<Holiday> holidays
) {
    public record Holiday(String id, String title, LocalDate startDate,
                          LocalDate endDateExclusive, String sourceUrl) {}
}

package com.sharedplanner.calendarimport;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.UUID;

public record CalendarImportRequest(
        @NotBlank @Size(max=1_000_000) String ical,
        @NotBlank @Size(max=512) String sourceCalendarId,
        @NotNull UUID targetCalendarId,
        @NotBlank @Size(max=80) String zoneId,
        @NotNull LocalDate windowStart,
        @NotNull LocalDate windowEnd,
        boolean mappingConfirmed,
        boolean privateEventsAuthorized
) {
    /** Existing clients remain conservative: private events require a separate explicit opt-in. */
    public CalendarImportRequest(String ical,String sourceCalendarId,UUID targetCalendarId,String zoneId,
                                 LocalDate windowStart,LocalDate windowEnd,boolean mappingConfirmed) {
        this(ical,sourceCalendarId,targetCalendarId,zoneId,windowStart,windowEnd,mappingConfirmed,false);
    }
}

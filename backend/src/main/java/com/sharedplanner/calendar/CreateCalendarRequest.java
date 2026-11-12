package com.sharedplanner.calendar;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;

public record CreateCalendarRequest(
        @NotBlank
        @Size(max = 120)
        String name,
        CalendarType calendarType,
        @Email @Size(max = 180) String ownerEmail
) {
    public CreateCalendarRequest(String name) { this(name, null, null); }
    public CreateCalendarRequest(String name, CalendarType calendarType) { this(name, calendarType, null); }
}

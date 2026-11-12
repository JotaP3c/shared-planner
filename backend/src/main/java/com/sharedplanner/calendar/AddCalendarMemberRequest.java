package com.sharedplanner.calendar;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;

public record AddCalendarMemberRequest(
        @NotBlank
        @Email
        String email,

        CalendarMemberRole role,
        Set<CalendarMemberRole> roles
) {
    public AddCalendarMemberRequest(String email, CalendarMemberRole role) { this(email, role, null); }
}

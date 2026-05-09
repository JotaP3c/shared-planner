package com.sharedplanner.calendar;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AddCalendarMemberRequest(
        @NotBlank
        @Email
        String email
) {
}

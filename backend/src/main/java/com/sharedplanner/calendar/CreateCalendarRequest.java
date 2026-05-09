package com.sharedplanner.calendar;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCalendarRequest(
        @NotBlank
        @Size(max = 120)
        String name
) {
}

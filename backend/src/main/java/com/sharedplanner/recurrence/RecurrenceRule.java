package com.sharedplanner.recurrence;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

/** A finite calendar rule. Dates and times remain civil times in zoneId. */
public record RecurrenceRule(
        @NotNull Frequency frequency,
        @Min(1) @Max(52) Integer interval,
        Set<@NotNull DayOfWeek> weekDays,
        LocalDate until,
        @Min(1) @Max(366) Integer count,
        @NotNull String zoneId
) {
    public enum Frequency { DAILY, WEEKLY, BIWEEKLY, MONTHLY, CUSTOM, YEARLY }
}

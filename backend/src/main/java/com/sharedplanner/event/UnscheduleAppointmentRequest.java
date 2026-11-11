package com.sharedplanner.event;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * Desmarcação de atendimento. {@code notes} é obrigatório quando {@code reason = OTHER};
 * {@code newStartsAt}/{@code newEndsAt} são obrigatórios quando {@code reason = RESCHEDULE}.
 */
public record UnscheduleAppointmentRequest(
        @NotNull
        UnscheduleReason reason,

        @Size(max = 500)
        String notes,

        LocalDateTime newStartsAt,

        LocalDateTime newEndsAt
) {
}

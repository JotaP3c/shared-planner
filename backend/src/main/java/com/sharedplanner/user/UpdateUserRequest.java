package com.sharedplanner.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank
        @Size(max = 120)
        String fullName,

        @NotNull
        UserRole role,

        @NotNull
        Boolean active
) {
}

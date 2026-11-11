package com.sharedplanner.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank
        @Size(max = 120)
        String fullName,

        @NotBlank
        @Email
        @Size(max = 180)
        String email,

        // BCrypt considera no máximo 72 bytes.
        @NotBlank
        @Size(min = 6, max = 72)
        String password,

        @NotNull
        UserRole role
) {
}

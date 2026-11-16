package com.sharedplanner.user;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Set;
import com.sharedplanner.access.Permission;

public record UserResponse(
        UUID id,
        String fullName,
        String email,
        UserRole role,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Set<Permission> permissions
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getActive(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                Set.of()
        );
    }

    public UserResponse withPermissions(Set<Permission> values) {
        return new UserResponse(id,fullName,email,role,active,createdAt,updatedAt,values);
    }
}

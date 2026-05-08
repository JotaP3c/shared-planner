package com.sharedplanner.auth;

public record LoginResponse(
        String accessToken,
        String tokenType
) {
}

package com.sharedplanner.auth;

public record LoginResponse(
        String accessToken,
        String tokenType
) {
    @Override public String toString() { return "LoginResponse[accessToken=<redacted>, tokenType=" + tokenType + "]"; }
}

package com.sharedplanner.auth;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthenticatedUserController {

    @GetMapping("/api/auth/me")
    public String me(Authentication authentication) {
        return authentication.getName();
    }
}

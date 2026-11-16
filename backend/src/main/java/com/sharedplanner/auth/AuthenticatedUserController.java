package com.sharedplanner.auth;

import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserResponse;
import com.sharedplanner.config.AuthorizationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthenticatedUserController {

    private final UserRepository userRepository;
    private final AuthorizationService authorization;

    public AuthenticatedUserController(UserRepository userRepository, AuthorizationService authorization) {
        this.userRepository = userRepository;
        this.authorization = authorization;
    }

    @GetMapping("/api/auth/me")
    public UserResponse me(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .map(user -> UserResponse.from(user).withPermissions(authorization.globalPermissions(authentication)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

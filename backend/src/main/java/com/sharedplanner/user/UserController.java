package com.sharedplanner.user;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(
            @RequestBody @Valid CreateUserRequest request,
            Authentication authentication
    ) {
        return userService.create(request, authentication);
    }

    @PutMapping("/{userId}")
    public UserResponse update(
            @PathVariable UUID userId,
            @RequestBody @Valid UpdateUserRequest request,
            Authentication authentication
    ) {
        return userService.update(userId, request, authentication);
    }

}

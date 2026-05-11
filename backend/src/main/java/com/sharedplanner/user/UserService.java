package com.sharedplanner.user;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.config.AuthorizationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthorizationService authorizationService;
    private final AuditService auditService;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuthorizationService authorizationService,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
    }

    @Transactional
    public UserResponse create(CreateUserRequest request, Authentication authentication) {
        authorizationService.ensureSystemAdmin(authentication);

        User currentUser = currentUser(authentication);

        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        User user = new User(
                request.fullName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.role(),
                currentUser
        );

        User savedUser = userRepository.save(user);

        auditService.log(
                AuditEntityType.USER,
                savedUser.getId(),
                null,
                AuditAction.CREATED,
                "User created: " + savedUser.getEmail(),
                null,
                userSnapshot(savedUser),
                currentUser
        );

        return UserResponse.from(savedUser);
    }

    @Transactional
    public UserResponse update(UUID userId, UpdateUserRequest request, Authentication authentication) {
        authorizationService.ensureSystemAdmin(authentication);

        User currentUser = currentUser(authentication);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getId().equals(currentUser.getId())) {
            if (!request.active()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate your own user");
            }

            if (request.role() != UserRole.ADMIN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove your own admin role");
            }
        }

        String oldValue = userSnapshot(user);

        user.updateProfile(
                request.fullName(),
                request.role(),
                request.active(),
                currentUser
        );

        auditService.log(
                AuditEntityType.USER,
                user.getId(),
                null,
                AuditAction.UPDATED,
                "User updated: " + user.getEmail(),
                oldValue,
                userSnapshot(user),
                currentUser
        );

        return UserResponse.from(user);
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private String userSnapshot(User user) {
        return "fullName=" + user.getFullName()
                + "; email=" + user.getEmail()
                + "; role=" + user.getRole()
                + "; active=" + user.getActive();
    }
}

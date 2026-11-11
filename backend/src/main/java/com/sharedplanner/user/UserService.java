package com.sharedplanner.user;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.config.AuthorizationService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
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

    @Transactional(readOnly = true)
    public List<UserResponse> list(Authentication authentication) {
        authorizationService.ensureSystemAdmin(authentication);
        return userRepository.findAllByOrderByFullNameAsc()
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(CreateUserRequest request, Authentication authentication) {
        authorizationService.ensureSystemAdmin(authentication);

        User currentUser = currentUser(authentication);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String fullName = request.fullName().trim();

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        User user = new User(
                fullName,
                email,
                passwordEncoder.encode(request.password()),
                request.role(),
                currentUser
        );

        User savedUser;
        try {
            savedUser = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            // Cadastro concorrente do mesmo e-mail: índice único case-insensitive (V7).
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

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

        // A aplicação precisa manter ao menos um ADMIN ativo. Pela API atual a autoproteção
        // acima já garante isso (só um ADMIN ativo administra); a guarda é defensiva para
        // fluxos futuros (ex.: jobs, importações) que alterem usuários.
        boolean removesActiveAdmin = user.getRole() == UserRole.ADMIN
                && Boolean.TRUE.equals(user.getActive())
                && (request.role() != UserRole.ADMIN || !request.active());
        if (removesActiveAdmin && userRepository.countByRoleAndActiveTrue(UserRole.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one active administrator is required");
        }

        String oldValue = userSnapshot(user);

        user.updateProfile(
                request.fullName().trim(),
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

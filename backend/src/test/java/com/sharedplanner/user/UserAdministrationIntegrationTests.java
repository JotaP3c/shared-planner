package com.sharedplanner.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** INC-04 — administração de usuários: edição, desativação lógica e proteções de ADMIN. */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class UserAdministrationIntegrationTests {

    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;

    @Test
    void createsUserWithNormalizedEmailAndRejectsDuplicate() {
        User admin = save("Admin", "users-create-admin@example.com", UserRole.ADMIN);

        UserResponse created = userService.create(
                new CreateUserRequest("  Ana  ", " Ana@Example.com ", "secret1", UserRole.USER), auth(admin));

        assertThat(created.email()).isEqualTo("ana@example.com");
        assertThat(created.fullName()).isEqualTo("Ana");
        assertStatus(() -> userService.create(
                new CreateUserRequest("Ana 2", "ANA@example.com", "secret1", UserRole.USER), auth(admin)),
                HttpStatus.CONFLICT);
    }

    @Test
    void editsNameRoleAndDeactivatesAnotherUserLogically() {
        User admin = save("Admin", "users-edit-admin@example.com", UserRole.ADMIN);
        User target = save("Bruno", "users-edit-target@example.com", UserRole.USER);

        UserResponse updated = userService.update(target.getId(),
                new UpdateUserRequest("Bruno Souza", UserRole.FINANCE, true), auth(admin));
        assertThat(updated.fullName()).isEqualTo("Bruno Souza");
        assertThat(updated.role()).isEqualTo(UserRole.FINANCE);

        UserResponse deactivated = userService.update(target.getId(),
                new UpdateUserRequest("Bruno Souza", UserRole.FINANCE, false), auth(admin));
        assertThat(deactivated.active()).isFalse();
        // Desativação lógica: o registro continua existindo (histórico e FKs preservados).
        assertThat(userRepository.findById(target.getId())).isPresent();

        UserResponse reactivated = userService.update(target.getId(),
                new UpdateUserRequest("Bruno Souza", UserRole.FINANCE, true), auth(admin));
        assertThat(reactivated.active()).isTrue();
    }

    @Test
    void adminCannotDeactivateOrDemoteThemselves() {
        User admin = save("Admin", "users-self-admin@example.com", UserRole.ADMIN);
        save("Other admin", "users-self-other@example.com", UserRole.ADMIN);

        assertStatus(() -> userService.update(admin.getId(),
                new UpdateUserRequest("Admin", UserRole.ADMIN, false), auth(admin)), HttpStatus.BAD_REQUEST);
        assertStatus(() -> userService.update(admin.getId(),
                new UpdateUserRequest("Admin", UserRole.USER, true), auth(admin)), HttpStatus.BAD_REQUEST);
    }

    @Test
    void theLastActiveAdministratorCanNeverBeRemoved() {
        User first = save("First admin", "users-last-first@example.com", UserRole.ADMIN);
        User second = save("Second admin", "users-last-second@example.com", UserRole.ADMIN);

        // Com dois ADMIN ativos, um pode desativar o outro.
        userService.update(second.getId(), new UpdateUserRequest("Second admin", UserRole.ADMIN, false), auth(first));
        assertThat(userRepository.countByRoleAndActiveTrue(UserRole.ADMIN)).isEqualTo(1L);

        // O único ADMIN ativo restante não consegue se desativar nem se rebaixar, e o inativo
        // não consegue agir (não autentica como ativo): sempre resta um ADMIN ativo.
        assertStatus(() -> userService.update(first.getId(),
                new UpdateUserRequest("First admin", UserRole.ADMIN, false), auth(first)), HttpStatus.BAD_REQUEST);
        assertStatus(() -> userService.update(first.getId(),
                new UpdateUserRequest("First admin", UserRole.USER, true), auth(first)), HttpStatus.BAD_REQUEST);
        assertStatus(() -> userService.update(first.getId(),
                new UpdateUserRequest("First admin", UserRole.USER, true), auth(second)), HttpStatus.NOT_FOUND);
        assertThat(userRepository.countByRoleAndActiveTrue(UserRole.ADMIN)).isEqualTo(1L);
    }

    @Test
    void nonAdminCannotManageUsers() {
        User regular = save("Regular", "users-forbidden-regular@example.com", UserRole.USER);
        User target = save("Target", "users-forbidden-target@example.com", UserRole.USER);

        assertStatus(() -> userService.list(auth(regular)), HttpStatus.FORBIDDEN);
        assertStatus(() -> userService.update(target.getId(),
                new UpdateUserRequest("Target", UserRole.ADMIN, true), auth(regular)), HttpStatus.FORBIDDEN);
    }

    private void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(status));
    }

    private User save(String name, String email, UserRole role) {
        return userRepository.save(new User(name, email, "unused", role, null));
    }

    private static UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }
}

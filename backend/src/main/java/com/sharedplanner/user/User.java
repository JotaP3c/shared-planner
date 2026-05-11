package com.sharedplanner.user;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "email", nullable = false, length = 180)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 30)
    private UserRole role;

    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedBy;

    protected User() {
    }

    public User(String fullName, String email, String passwordHash, UserRole role, User createdBy) {
        this.id = UUID.randomUUID();
        this.fullName = fullName;
        this.email = email.toLowerCase();
        this.passwordHash = passwordHash;
        this.role = role;
        this.active = true;
        this.createdAt = LocalDateTime.now();
        this.createdBy = createdBy;
    }

    public UUID getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserRole getRole() {
        return role;
    }

    public Boolean getActive() {
        return active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public User getUpdatedBy() {
        return updatedBy;
    }

    public void changeRole(UserRole role, User updatedBy) {
        this.role = role;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateProfile(String fullName, UserRole role, Boolean active, User updatedBy) {
        this.fullName = fullName;
        this.role = role;
        this.active = active;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }
}

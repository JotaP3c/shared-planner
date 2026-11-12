package com.sharedplanner.calendar;

import com.sharedplanner.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "calendar_members")
public class CalendarMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calendar_id", nullable = false)
    private SharedCalendar calendar;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_role", nullable = false, length = 30)
    private CalendarMemberRole role;

    @ElementCollection
    @BatchSize(size = 50)
    @CollectionTable(name = "calendar_member_roles", joinColumns = @JoinColumn(name = "member_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 30)
    private Set<CalendarMemberRole> roles = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedBy;

    protected CalendarMember() {
    }

    public CalendarMember(SharedCalendar calendar, User user, CalendarMemberRole role, User createdBy) {
        this.calendar = calendar;
        this.user = user;
        this.role = role;
        this.roles.add(role);
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public SharedCalendar getCalendar() {
        return calendar;
    }

    public User getUser() {
        return user;
    }

    public CalendarMemberRole getRole() {
        return role;
    }

    public Set<CalendarMemberRole> getRoles() {
        return roles.isEmpty() ? Set.of(role) : Set.copyOf(roles);
    }

    public boolean hasRole(CalendarMemberRole candidate) { return getRoles().contains(candidate); }
    public boolean canManageMembers() { return hasRole(CalendarMemberRole.ADMIN); }
    public boolean canCreateEvents() { return canManageMembers() || hasRole(CalendarMemberRole.EDITOR); }
    public boolean canUseFinance() { return canManageMembers() || hasRole(CalendarMemberRole.FINANCE); }

    public User getCreatedBy() {
        return createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public User getUpdatedBy() {
        return updatedBy;
    }

    public void changeRole(CalendarMemberRole role, User updatedBy) {
        changeRoles(Set.of(role), updatedBy);
    }

    public void changeRoles(Set<CalendarMemberRole> roles, User updatedBy) {
        if (roles == null || roles.isEmpty() || roles.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("At least one calendar role is required");
        }
        this.roles.clear();
        this.roles.addAll(roles);
        this.role = roles.contains(CalendarMemberRole.ADMIN) ? CalendarMemberRole.ADMIN
                : roles.contains(CalendarMemberRole.EDITOR) ? CalendarMemberRole.EDITOR
                : roles.contains(CalendarMemberRole.FINANCE) ? CalendarMemberRole.FINANCE : CalendarMemberRole.VIEWER;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }
}

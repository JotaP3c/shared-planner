package com.sharedplanner.calendar;

import com.sharedplanner.user.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

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
        this.role = role;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }
}

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

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected CalendarMember() {
    }

    public CalendarMember(SharedCalendar calendar, User user, CalendarMemberRole role) {
        this.calendar = calendar;
        this.user = user;
        this.role = role;
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
}

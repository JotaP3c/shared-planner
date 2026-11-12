package com.sharedplanner.event;

import com.sharedplanner.user.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "event_approvals", uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "user_id", "approval_round"}))
public class EventApproval {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "event_id", nullable = false) private Event event;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "approval_round", nullable = false) private int round;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private EventApprovalStatus status;
    @Column(name = "requested_at", nullable = false) private LocalDateTime requestedAt;
    @Column(name = "responded_at") private LocalDateTime respondedAt;

    protected EventApproval() {}
    public EventApproval(Event event, User user, int round) {
        this.event = event; this.user = user; this.round = round;
        this.status = EventApprovalStatus.PENDING; this.requestedAt = LocalDateTime.now();
    }
    public User getUser() { return user; }
    public int getRound() { return round; }
    public EventApprovalStatus getStatus() { return status; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public LocalDateTime getRespondedAt() { return respondedAt; }
    public void respond(boolean approved) {
        status = approved ? EventApprovalStatus.APPROVED : EventApprovalStatus.REJECTED;
        respondedAt = LocalDateTime.now();
    }
}

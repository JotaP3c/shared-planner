package com.sharedplanner.audit;

import com.sharedplanner.user.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 40)
    private AuditEntityType entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "calendar_id")
    private UUID calendarId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40)
    private AuditAction action;

    @Column(name = "summary", nullable = false, length = 500)
    private String summary;

    @Column(name = "old_value", columnDefinition = "nvarchar(max)")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "nvarchar(max)")
    private String newValue;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "performed_by_user_id", nullable = false)
    private User performedBy;

    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt;

    protected AuditLog() {
    }

    public AuditLog(
            AuditEntityType entityType,
            UUID entityId,
            UUID calendarId,
            AuditAction action,
            String summary,
            String oldValue,
            String newValue,
            User performedBy
    ) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.calendarId = calendarId;
        this.action = action;
        this.summary = summary;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.performedBy = performedBy;
        this.performedAt = LocalDateTime.now();
    }
}

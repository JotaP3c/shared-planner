package com.sharedplanner.audit;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        AuditEntityType entityType,
        UUID entityId,
        UUID calendarId,
        AuditAction action,
        String summary,
        String oldValue,
        String newValue,
        String performedByEmail,
        LocalDateTime performedAt
) {
    public static AuditLogResponse from(AuditLog auditLog) {
        return new AuditLogResponse(
                auditLog.getId(),
                auditLog.getEntityType(),
                auditLog.getEntityId(),
                auditLog.getCalendarId(),
                auditLog.getAction(),
                auditLog.getSummary(),
                auditLog.getOldValue(),
                auditLog.getNewValue(),
                auditLog.getPerformedBy().getEmail(),
                auditLog.getPerformedAt()
        );
    }
}

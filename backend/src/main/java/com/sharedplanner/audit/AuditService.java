package com.sharedplanner.audit;

import com.sharedplanner.user.User;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(
            AuditEntityType entityType,
            UUID entityId,
            UUID calendarId,
            AuditAction action,
            String summary,
            String oldValue,
            String newValue,
            User performedBy
    ) {
        auditLogRepository.save(new AuditLog(
                entityType,
                entityId,
                calendarId,
                action,
                limit(summary),
                oldValue,
                newValue,
                performedBy
        ));
    }

    private String limit(String value) {
        if (value == null || value.length() <= 500) {
            return value;
        }

        return value.substring(0, 500);
    }
}

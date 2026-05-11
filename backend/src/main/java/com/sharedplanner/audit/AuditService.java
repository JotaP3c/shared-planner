package com.sharedplanner.audit;

import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class AuditService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;

    private final AuditLogRepository auditLogRepository;
    private final AuthorizationService authorizationService;

    public AuditService(
            AuditLogRepository auditLogRepository,
            AuthorizationService authorizationService
    ) {
        this.auditLogRepository = auditLogRepository;
        this.authorizationService = authorizationService;
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
                limitSummary(summary),
                oldValue,
                newValue,
                performedBy
        ));
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> search(
            UUID calendarId,
            AuditEntityType entityType,
            UUID entityId,
            Integer limit,
            Authentication authentication
    ) {
        authorizationService.ensureCanViewAuditLogs(calendarId, authentication);

        return auditLogRepository.search(
                        calendarId,
                        entityType,
                        entityId,
                        PageRequest.of(0, normalizeLimit(limit))
                )
                .stream()
                .map(AuditLogResponse::from)
                .toList();
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }

        if (limit <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be greater than zero");
        }

        return Math.min(limit, MAX_LIMIT);
    }

    private String limitSummary(String value) {
        if (value == null || value.length() <= 500) {
            return value;
        }

        return value.substring(0, 500);
    }
}

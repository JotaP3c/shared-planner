package com.sharedplanner.audit;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("""
            select auditLog
            from AuditLog auditLog
            where (:calendarId is null or auditLog.calendarId = :calendarId)
              and (:entityType is null or auditLog.entityType = :entityType)
              and (:entityId is null or auditLog.entityId = :entityId)
            order by auditLog.performedAt desc
            """)
    List<AuditLog> search(
            @Param("calendarId") UUID calendarId,
            @Param("entityType") AuditEntityType entityType,
            @Param("entityId") UUID entityId,
            Pageable pageable
    );
}

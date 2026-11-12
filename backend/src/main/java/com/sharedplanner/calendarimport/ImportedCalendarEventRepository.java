package com.sharedplanner.calendarimport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface ImportedCalendarEventRepository extends JpaRepository<ImportedCalendarEvent,UUID> {
    boolean existsByIdentityKey(String key);
}

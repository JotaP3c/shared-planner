package com.sharedplanner.finance;

import com.sharedplanner.event.Event;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Bounded export query; the population is identical to FinanceService's summary. */
public interface FinanceExportEventRepository extends Repository<Event, UUID> {
    @Query("""
            select count(e) as appointmentCount,
                coalesce(sum(length(coalesce(e.workDescription, ''))
                    + length(coalesce(e.clientName, '')) + length(e.calendar.name)), 0) as textCharacters,
                coalesce(max(length(coalesce(e.workDescription, ''))), 0) as longestService
            from Event e
            where e.calendar.id in :calendarIds
              and e.eventType = com.sharedplanner.event.EventType.CLIENT
              and e.status <> com.sharedplanner.event.EventStatus.CANCELLED
              and e.startsAt >= :start
              and e.startsAt < :end
            """)
    ExportBudget budget(@Param("calendarIds") List<UUID> calendarIds,
                        @Param("start") LocalDateTime start,
                        @Param("end") LocalDateTime end);

    @Query("""
            select e from Event e join fetch e.calendar
            where e.calendar.id in :calendarIds
              and e.eventType = com.sharedplanner.event.EventType.CLIENT
              and e.status <> com.sharedplanner.event.EventStatus.CANCELLED
              and e.startsAt >= :start
              and e.startsAt < :end
            order by e.startsAt asc, e.id asc
            """)
    List<Event> findExportEvents(@Param("calendarIds") List<UUID> calendarIds,
                                 @Param("start") LocalDateTime start,
                                 @Param("end") LocalDateTime end,
                                 Pageable limit);

    interface ExportBudget {
        Long getAppointmentCount();
        Long getTextCharacters();
        Integer getLongestService();
    }
}

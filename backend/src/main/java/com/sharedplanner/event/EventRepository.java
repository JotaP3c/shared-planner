package com.sharedplanner.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {

    List<Event> findByCalendarIdAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(
            UUID calendarId,
            LocalDateTime end,
            LocalDateTime start
    );

    @Query("""
            select sum(e.amount) as totalAmount, count(e) as appointmentCount
            from Event e
            where e.calendar.id = :calendarId
              and e.eventType = :eventType
              and e.status <> :excludedStatus
              and e.startsAt >= :start
              and e.startsAt < :end
            """)
    ClientRevenueTotals summarizeClientRevenue(
            @Param("calendarId") UUID calendarId,
            @Param("eventType") EventType eventType,
            @Param("excludedStatus") EventStatus excludedStatus,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}

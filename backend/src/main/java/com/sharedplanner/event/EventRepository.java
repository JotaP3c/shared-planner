package com.sharedplanner.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import com.sharedplanner.finance.FinanceTotals;

public interface EventRepository extends JpaRepository<Event, UUID> {

    List<Event> findByCalendarIdAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(
            UUID calendarId,
            LocalDateTime end,
            LocalDateTime start
    );

    List<Event> findByStatusOrderByStartsAtAsc(EventStatus status);

    List<Event> findByStatusAndApprovalRequestedFromEmailIgnoreCaseOrderByStartsAtAsc(
            EventStatus status,
            String email
    );

    @Query("""
            select e
            from Event e
            where e.status <> :excludedStatus
              and (
                lower(coalesce(e.title, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.clientName, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.personName, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.description, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.workDescription, '')) like lower(concat('%', :term, '%'))
                or lower(e.createdBy.email) like lower(concat('%', :term, '%'))
                or lower(e.calendar.name) like lower(concat('%', :term, '%'))
              )
            order by e.startsAt asc
            """)
    List<Event> searchVisibleEventsForAdmin(
            @Param("term") String term,
            @Param("excludedStatus") EventStatus excludedStatus,
            Pageable pageable
    );

    @Query("""
            select e
            from Event e
            where e.calendar.id in :calendarIds
              and e.status <> :excludedStatus
              and (
                lower(coalesce(e.title, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.clientName, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.personName, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.description, '')) like lower(concat('%', :term, '%'))
                or lower(coalesce(e.workDescription, '')) like lower(concat('%', :term, '%'))
                or lower(e.createdBy.email) like lower(concat('%', :term, '%'))
                or lower(e.calendar.name) like lower(concat('%', :term, '%'))
              )
            order by e.startsAt asc
            """)
    List<Event> searchVisibleEventsForMember(
            @Param("calendarIds") List<UUID> calendarIds,
            @Param("term") String term,
            @Param("excludedStatus") EventStatus excludedStatus,
            Pageable pageable
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

    @Query("""
        select
            coalesce(sum(e.amount), 0) as expectedAmount,
            coalesce(sum(e.receivedAmount), 0) as receivedAmount,
            count(e) as appointmentCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PAID then 1 else 0 end) as paidCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PENDING then 1 else 0 end) as pendingCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PARTIALLY_PAID then 1 else 0 end) as partiallyPaidCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.REFUNDED then 1 else 0 end) as refundedCount
        from Event e
        where e.calendar.id = :calendarId
          and e.eventType = com.sharedplanner.event.EventType.CLIENT
          and e.status <> com.sharedplanner.event.EventStatus.CANCELLED
          and e.startsAt >= :start
          and e.startsAt < :end
        """)
    FinanceTotals summarizeFinance(
            @Param("calendarId") UUID calendarId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}

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

    @Query("""
            select e
            from Event e
            where e.status = :status
              and lower(e.approvalRequestedFrom.email) = lower(:email)
              and exists (
                select cm.id
                from CalendarMember cm
                where cm.calendar.id = e.calendar.id
                  and cm.user.id = :userId
              )
            order by e.startsAt asc
            """)
    List<Event> findPendingApprovalsForCurrentMember(
            @Param("status") EventStatus status,
            @Param("email") String email,
            @Param("userId") UUID userId
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

    /**
     * Desmarcados pelo cliente (confirmationStatus = CANCELLED) saem da receita prevista e
     * pendente, mas o valor recebido deles continua contabilizado. Legado com
     * confirmationStatus nulo é tratado como aguardando confirmação.
     */
    @Query("""
        select
            coalesce(sum(case when e.confirmationStatus is null
                    or e.confirmationStatus <> com.sharedplanner.event.AppointmentConfirmationStatus.CANCELLED
                then e.amount else 0 end), 0) as expectedAmount,
            coalesce(sum(e.receivedAmount), 0) as receivedAmount,
            coalesce(sum(case when e.confirmationStatus is null
                    or e.confirmationStatus <> com.sharedplanner.event.AppointmentConfirmationStatus.CANCELLED
                then e.amount - e.receivedAmount else 0 end), 0) as pendingAmount,
            coalesce(sum(case when e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.CONFIRMED
                then e.amount else 0 end), 0) as confirmedAmount,
            coalesce(sum(case when e.confirmationStatus is null
                    or e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.PENDING_CONFIRMATION
                    or e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.RESCHEDULED
                then e.amount else 0 end), 0) as unconfirmedAmount,
            coalesce(sum(case when e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.CANCELLED
                then e.amount else 0 end), 0) as unscheduledAmount,
            count(e) as appointmentCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PAID then 1 else 0 end) as paidCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PENDING then 1 else 0 end) as pendingCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.PARTIALLY_PAID then 1 else 0 end) as partiallyPaidCount,
            sum(case when e.paymentStatus = com.sharedplanner.event.PaymentStatus.REFUNDED then 1 else 0 end) as refundedCount,
            sum(case when e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.CONFIRMED
                then 1 else 0 end) as confirmedCount,
            sum(case when e.confirmationStatus is null
                    or e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.PENDING_CONFIRMATION
                then 1 else 0 end) as awaitingConfirmationCount,
            sum(case when e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.RESCHEDULED
                then 1 else 0 end) as rescheduledCount,
            sum(case when e.confirmationStatus = com.sharedplanner.event.AppointmentConfirmationStatus.CANCELLED
                then 1 else 0 end) as unscheduledCount,
            coalesce(sum(e.rescheduleCount), 0) as rescheduleOccurrences
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

    /** Mesma população do resumo financeiro, para evolução e lista de atendimentos. */
    @Query("""
        select e
        from Event e
        where e.calendar.id = :calendarId
          and e.eventType = com.sharedplanner.event.EventType.CLIENT
          and e.status <> com.sharedplanner.event.EventStatus.CANCELLED
          and e.startsAt >= :start
          and e.startsAt < :end
        order by e.startsAt desc
        """)
    List<Event> findFinanceEvents(
            @Param("calendarId") UUID calendarId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable
    );
}

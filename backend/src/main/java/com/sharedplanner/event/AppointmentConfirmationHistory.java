package com.sharedplanner.event;

import com.sharedplanner.user.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Histórico imutável das mudanças de confirmação/desmarcação/remarcação de um atendimento. */
@Entity
@Table(name = "appointment_confirmation_history")
public class AppointmentConfirmationHistory {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 30)
    private AppointmentConfirmationStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 30)
    private AppointmentConfirmationStatus newStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", length = 30)
    private UnscheduleReason reason;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "previous_starts_at")
    private LocalDateTime previousStartsAt;

    @Column(name = "previous_ends_at")
    private LocalDateTime previousEndsAt;

    @Column(name = "new_starts_at")
    private LocalDateTime newStartsAt;

    @Column(name = "new_ends_at")
    private LocalDateTime newEndsAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "performed_by_user_id", nullable = false)
    private User performedBy;

    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt;

    protected AppointmentConfirmationHistory() {
    }

    public AppointmentConfirmationHistory(
            Event event,
            AppointmentConfirmationStatus previousStatus,
            AppointmentConfirmationStatus newStatus,
            UnscheduleReason reason,
            String notes,
            LocalDateTime previousStartsAt,
            LocalDateTime previousEndsAt,
            LocalDateTime newStartsAt,
            LocalDateTime newEndsAt,
            User performedBy
    ) {
        this.id = UUID.randomUUID();
        this.event = event;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.reason = reason;
        this.notes = notes;
        this.previousStartsAt = previousStartsAt;
        this.previousEndsAt = previousEndsAt;
        this.newStartsAt = newStartsAt;
        this.newEndsAt = newEndsAt;
        this.performedBy = performedBy;
        this.performedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Event getEvent() { return event; }
    public AppointmentConfirmationStatus getPreviousStatus() { return previousStatus; }
    public AppointmentConfirmationStatus getNewStatus() { return newStatus; }
    public UnscheduleReason getReason() { return reason; }
    public String getNotes() { return notes; }
    public LocalDateTime getPreviousStartsAt() { return previousStartsAt; }
    public LocalDateTime getPreviousEndsAt() { return previousEndsAt; }
    public LocalDateTime getNewStartsAt() { return newStartsAt; }
    public LocalDateTime getNewEndsAt() { return newEndsAt; }
    public User getPerformedBy() { return performedBy; }
    public LocalDateTime getPerformedAt() { return performedAt; }
}

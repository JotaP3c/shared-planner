package com.sharedplanner.event;

import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calendar_id", nullable = false)
    private SharedCalendar calendar;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_requested_from_user_id")
    private User approvalRequestedFrom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_user_id")
    private User approvedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private EventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private EventStatus status;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Column(name = "client_name", length = 120)
    private String clientName;

    @Column(name = "client_phone", length = 11)
    private String clientPhone;

    @Column(name = "external_source", length = 30)
    private String externalSource;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    @Column(name = "approval_round", nullable = false)
    private int approvalRound;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL)
    @BatchSize(size = 50)
    private List<EventApproval> approvals = new ArrayList<>();

    @Column(name = "person_name", length = 120)
    private String personName;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "work_description", columnDefinition = "text")
    private String workDescription;

    @Column(name = "amount", precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    private PaymentStatus paymentStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "received_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal receivedAmount;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "confirmation_status", length = 30)
    private AppointmentConfirmationStatus confirmationStatus;

    @Column(name = "confirmation_changed_at")
    private LocalDateTime confirmationChangedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmation_changed_by_user_id")
    private User confirmationChangedBy;

    @Column(name = "reschedule_count", nullable = false)
    private int rescheduleCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "unschedule_reason", length = 30)
    private UnscheduleReason unscheduleReason;

    @Column(name = "unschedule_notes", length = 500)
    private String unscheduleNotes;

    protected Event() {
    }

    public Event(SharedCalendar calendar, User createdBy) {
        this.calendar = calendar;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public SharedCalendar getCalendar() { return calendar; }
    public User getCreatedBy() { return createdBy; }
    public User getApprovalRequestedFrom() { return approvalRequestedFrom; }
    public User getApprovedBy() { return approvedBy; }
    public EventType getEventType() { return eventType; }
    public EventStatus getStatus() { return status; }
    public String getTitle() { return title; }
    public String getClientName() { return clientName; }
    public String getClientPhone() { return clientPhone; }
    public String getExternalSource() { return externalSource; }
    public void setExternalSource(String value) { externalSource = value; }
    public boolean isAllDay() { return allDay; }
    public int getApprovalRound() { return approvalRound; }
    public List<EventApproval> getApprovalHistory() { return List.copyOf(approvals); }
    public List<EventApproval> getCurrentApprovals() {
        return approvals.stream().filter(item -> item.getRound() == approvalRound).toList();
    }
    public void setClientPhone(String phone) { clientPhone = eventType == EventType.CLIENT ? phone : null; }
    public void setAllDay(boolean value) { allDay = value; }
    public String clientDescription() {
        if (eventType != EventType.CLIENT) return description;
        String work = workDescription == null ? "" : workDescription.trim();
        String notes = description == null ? "" : description.trim();
        return work.isEmpty() ? notes : notes.isEmpty() || work.equals(notes) ? work : work + "\n\n" + notes;
    }
    public void beginApprovalRound(List<User> users) {
        approvalRound++;
        approvedBy = null;
        approvalRequestedFrom = users.get(0);
        status = EventStatus.PENDING_APPROVAL;
        users.forEach(user -> approvals.add(new EventApproval(this, user, approvalRound)));
    }
    public void finishApprovalRound() {
        approvalRound++;
        approvalRequestedFrom = null;
        approvedBy = null;
    }
    public String getPersonName() { return personName; }
    public String getDescription() { return description; }
    public String getWorkDescription() { return workDescription; }
    public BigDecimal getAmount() { return amount; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public User getUpdatedBy() { return updatedBy; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public BigDecimal getReceivedAmount() { return receivedAmount; }
    public LocalDateTime getPaidAt() { return paidAt; }
    public AppointmentConfirmationStatus getConfirmationStatus() { return confirmationStatus; }
    public LocalDateTime getConfirmationChangedAt() { return confirmationChangedAt; }
    public User getConfirmationChangedBy() { return confirmationChangedBy; }
    public int getRescheduleCount() { return rescheduleCount; }
    public UnscheduleReason getUnscheduleReason() { return unscheduleReason; }
    public String getUnscheduleNotes() { return unscheduleNotes; }

    /** Situação efetiva: registros legados sem valor são tratados como aguardando confirmação. */
    public AppointmentConfirmationStatus effectiveConfirmationStatus() {
        if (eventType != EventType.CLIENT) {
            return null;
        }

        return confirmationStatus == null
                ? AppointmentConfirmationStatus.PENDING_CONFIRMATION
                : confirmationStatus;
    }


    public void fill(
            EventType eventType,
            EventStatus status,
            String title,
            String clientName,
            String personName,
            String description,
            String workDescription,
            BigDecimal amount,
            LocalDateTime startsAt,
            LocalDateTime endsAt,
            User approvalRequestedFrom,
            User updatedBy
    ) {
        this.eventType = eventType;
        this.status = status;
        this.title = title;
        this.description = description;

        if (eventType == EventType.CLIENT) {
            this.clientName = clientName;
            this.personName = null;
            this.workDescription = workDescription;
            this.amount = amount;

            if (this.paymentStatus == null) {
                resetPayment();
            }

            // Novo atendimento (ou conversão para CLIENT) começa aguardando confirmação.
            if (this.confirmationStatus == null) {
                this.confirmationStatus = AppointmentConfirmationStatus.PENDING_CONFIRMATION;
            }
        } else {
            this.clientName = null;
            this.personName = eventType == EventType.PERSONAL ? personName : null;
            this.workDescription = null;
            this.amount = null;
            resetPayment();
            resetConfirmation();
        }

        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.approvalRequestedFrom = eventType == EventType.SHARED ? approvalRequestedFrom : null;
        if (eventType != EventType.SHARED || status == EventStatus.PENDING_APPROVAL) {
            this.approvedBy = null;
        }
        this.updatedAt = LocalDateTime.now();
        this.updatedBy = updatedBy;
    }

    private void resetPayment() {
        this.paymentStatus = PaymentStatus.PENDING;
        this.paymentMethod = null;
        this.receivedAmount = BigDecimal.ZERO;
        this.paidAt = null;
    }

    public void registerPayment(
            PaymentStatus paymentStatus,
            PaymentMethod paymentMethod,
            BigDecimal receivedAmount,
            LocalDateTime paidAt,
            User updatedBy
    ) {
        this.paymentStatus = paymentStatus;
        this.paymentMethod = paymentMethod;
        this.receivedAmount = receivedAmount;
        this.paidAt = paidAt;
        this.updatedAt = LocalDateTime.now();
        this.updatedBy = updatedBy;
    }

    private void resetConfirmation() {
        this.confirmationStatus = null;
        this.confirmationChangedAt = null;
        this.confirmationChangedBy = null;
        this.rescheduleCount = 0;
        this.unscheduleReason = null;
        this.unscheduleNotes = null;
    }

    public void confirmAppointment(User changedBy) {
        this.confirmationStatus = AppointmentConfirmationStatus.CONFIRMED;
        this.unscheduleReason = null;
        this.unscheduleNotes = null;
        touchConfirmation(changedBy);
    }

    public void unscheduleAppointment(UnscheduleReason reason, String notes, User changedBy) {
        this.confirmationStatus = AppointmentConfirmationStatus.CANCELLED;
        this.unscheduleReason = reason;
        this.unscheduleNotes = notes;
        touchConfirmation(changedBy);
    }

    /** Remarcação altera a data do mesmo atendimento; valor e pagamento não são duplicados. */
    public void rescheduleAppointment(LocalDateTime newStartsAt, LocalDateTime newEndsAt, String notes, User changedBy) {
        this.startsAt = newStartsAt;
        this.endsAt = newEndsAt;
        this.confirmationStatus = AppointmentConfirmationStatus.RESCHEDULED;
        this.rescheduleCount++;
        this.unscheduleReason = UnscheduleReason.RESCHEDULE;
        this.unscheduleNotes = notes;
        touchConfirmation(changedBy);
    }

    private void touchConfirmation(User changedBy) {
        LocalDateTime now = LocalDateTime.now();
        this.confirmationChangedAt = now;
        this.confirmationChangedBy = changedBy;
        this.updatedAt = now;
        this.updatedBy = changedBy;
    }

    public void approve(User approvedBy) {
        this.status = EventStatus.APPROVED;
        this.approvedBy = approvedBy;
        this.updatedAt = LocalDateTime.now();
        this.updatedBy = approvedBy;
    }

    public void reject(User updatedBy) {
        this.status = EventStatus.REJECTED;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel(User updatedBy) {
        this.status = EventStatus.CANCELLED;
        this.updatedBy = updatedBy;
        this.updatedAt = LocalDateTime.now();
    }
}

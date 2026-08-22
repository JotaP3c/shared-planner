package com.sharedplanner.event;

import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.user.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

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
        this.clientName = clientName;
        this.personName = personName;
        this.description = description;
        this.workDescription = workDescription;
        this.amount = amount;

        if (this.paymentStatus == null) {
            this.paymentStatus = PaymentStatus.PENDING;
            this.receivedAmount = BigDecimal.ZERO;
        }

        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.approvalRequestedFrom = approvalRequestedFrom;
        this.updatedAt = LocalDateTime.now();
        this.updatedBy = updatedBy;
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

package com.sharedplanner.event;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AppointmentConfirmationHistoryRepository
        extends JpaRepository<AppointmentConfirmationHistory, UUID> {

    List<AppointmentConfirmationHistory> findByEventIdOrderByPerformedAtDesc(UUID eventId);
}

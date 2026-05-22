package com.sharedplanner.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CalendarMemberRepository extends JpaRepository<CalendarMember, UUID> {

    List<CalendarMember> findByUserEmailIgnoreCase(String email);

    List<CalendarMember> findByCalendarIdOrderByCreatedAtAsc(UUID calendarId);

    boolean existsByCalendarIdAndUserId(UUID calendarId, UUID userId);

    Optional<CalendarMember> findByCalendarIdAndUserId(UUID calendarId, UUID userId);

    Optional<CalendarMember> findByCalendarIdAndUserEmailIgnoreCase(UUID calendarId, String email);
}

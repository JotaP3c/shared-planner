package com.sharedplanner.calendar;

import java.util.UUID;
import java.util.Set;
import com.sharedplanner.access.Permission;

public record CalendarResponse(
        UUID id,
        String name,
        String ownerEmail,
        CalendarMemberRole memberRole,
        boolean canCreateEvents,
        CalendarType calendarType,
        Set<CalendarMemberRole> memberRoles,
        Set<Permission> permissions
) {
    static CalendarResponse from(SharedCalendar calendar) {
        return from(calendar, Set.of());
    }

    static CalendarResponse from(SharedCalendar calendar, CalendarMemberRole memberRole) {
        return from(calendar, memberRole == null ? Set.of() : Set.of(memberRole));
    }

    static CalendarResponse from(SharedCalendar calendar, Set<CalendarMemberRole> roles) {
        CalendarMemberRole memberRole = roles.contains(CalendarMemberRole.ADMIN) ? CalendarMemberRole.ADMIN
                : roles.contains(CalendarMemberRole.EDITOR) ? CalendarMemberRole.EDITOR
                : roles.contains(CalendarMemberRole.FINANCE) ? CalendarMemberRole.FINANCE
                : roles.contains(CalendarMemberRole.VIEWER) ? CalendarMemberRole.VIEWER : null;
        return new CalendarResponse(
                calendar.getId(),
                calendar.getName(),
                calendar.getOwner().getEmail(),
                memberRole,
                roles.stream().anyMatch(CalendarMemberRole::canCreateEvents),
                calendar.getCalendarType(),
                roles,
                Set.of()
        );
    }

    static CalendarResponse fromSystemAdmin(SharedCalendar calendar) {
        return from(calendar, CalendarMemberRole.ADMIN).withPermissions(Set.of(Permission.values()));
    }

    public CalendarResponse withPermissions(Set<Permission> values) {
        return new CalendarResponse(id,name,ownerEmail,memberRole,values.contains(Permission.EVENT_CREATE),calendarType,memberRoles,values);
    }
}

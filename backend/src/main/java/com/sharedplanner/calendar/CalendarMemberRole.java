package com.sharedplanner.calendar;

public enum CalendarMemberRole {
    ADMIN,
    FINANCE,
    EDITOR,
    VIEWER;

    public boolean canManageMembers() {
        return this == ADMIN;
    }

    public boolean canCreateEvents() {
        return this == ADMIN || this == EDITOR;
    }

    public boolean canEditAllEvents() {
        return this == ADMIN;
    }

    public boolean canEditOwnEvents() {
        return this == ADMIN || this == EDITOR;
    }

    public boolean canUseFinance() {
        return this == ADMIN || this == FINANCE;
    }
}

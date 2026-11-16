package com.sharedplanner.access;

import java.util.*;

public final class BuiltInProfiles {
    private BuiltInProfiles() { }
    public record Definition(String code,String name,ProfileScope scope,Set<Permission> permissions) { }
    private static Set<Permission> set(Permission... values) { return Set.of(values); }
    public static List<Definition> definitions() {
        EnumSet<Permission> common=EnumSet.allOf(Permission.class);
        common.removeAll(set(Permission.USERS_VIEW,Permission.USERS_MANAGE,Permission.ROLES_MANAGE,Permission.AUDIT_VIEW_ALL,Permission.FINANCE_MEMBER_CALENDARS));
        EnumSet<Permission> finance=EnumSet.copyOf(common);finance.add(Permission.FINANCE_MEMBER_CALENDARS);
        Set<Permission> viewer=set(Permission.CALENDAR_VIEW,Permission.MEMBERS_VIEW,Permission.EVENT_APPROVE);
        EnumSet<Permission> editor=EnumSet.copyOf(viewer);
        editor.addAll(set(Permission.EVENT_CREATE,Permission.EVENT_EDIT,Permission.EVENT_CANCEL,Permission.FINANCE_VIEW_OWN,Permission.FINANCE_MANAGE_OWN,Permission.CALENDAR_IMPORT));
        EnumSet<Permission> calendarFinance=EnumSet.copyOf(viewer);
        calendarFinance.addAll(set(Permission.FINANCE_VIEW,Permission.FINANCE_EXPORT));
        EnumSet<Permission> admin=EnumSet.noneOf(Permission.class);
        for(Permission permission:Permission.values())if(!permission.globalOnly())admin.add(permission);
        return List.of(
                new Definition("SYSTEM_ADMIN","Administrador do sistema",ProfileScope.GLOBAL,Set.of(Permission.values())),
                new Definition("SYSTEM_FINANCE","Financeiro do sistema",ProfileScope.GLOBAL,Set.copyOf(finance)),
                new Definition("USER","Usuário",ProfileScope.GLOBAL,Set.copyOf(common)),
                new Definition("CALENDAR_ADMIN","Administrador de calendário",ProfileScope.CALENDAR,Set.copyOf(admin)),
                new Definition("CALENDAR_EDITOR","Editor de calendário",ProfileScope.CALENDAR,Set.copyOf(editor)),
                new Definition("CALENDAR_VIEWER","Visualizador de calendário",ProfileScope.CALENDAR,viewer),
                new Definition("CALENDAR_FINANCE","Financeiro de calendário",ProfileScope.CALENDAR,Set.copyOf(calendarFinance)));
    }
    public static Definition definition(String code) {
        return definitions().stream().filter(value->value.code().equals(code)).findFirst().orElseThrow();
    }
}

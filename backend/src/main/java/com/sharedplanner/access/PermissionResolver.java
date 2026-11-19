package com.sharedplanner.access;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRole;
import org.springframework.stereotype.Service;
import java.util.*;

/** Resolves configured profiles; no cache across requests, so revocation is immediate. */
@Service
public class PermissionResolver {
    private final AccessProfileRepository profiles;
    private final AccessAssignmentRepository assignments;
    public PermissionResolver(AccessProfileRepository profiles,AccessAssignmentRepository assignments) {
        this.profiles=profiles;this.assignments=assignments;
    }
    public Set<Permission> global(User user) {
        if(user.getRole()==UserRole.ADMIN)return Set.of(Permission.values());
        return assigned(user.getId(),null).map(this::enabledPermissions).orElseGet(()->builtIn(
                user.getRole()==UserRole.FINANCE?"SYSTEM_FINANCE":"USER"));
    }
    public Set<Permission> contextual(User user,CalendarMember member) {
        if(user.getRole()==UserRole.ADMIN)return Set.of(Permission.values());
        Set<Permission> global=global(user);
        EnumSet<Permission> contextual=EnumSet.noneOf(Permission.class);
        if(member.getCalendar().getOwner().getId().equals(user.getId())) {
            contextual.addAll(BuiltInProfiles.definition("CALENDAR_ADMIN").permissions());
        } else {
            Optional<AccessAssignment> assignment=assigned(user.getId(),member.getCalendar().getId());
            if(assignment.isPresent())contextual.addAll(enabledPermissions(assignment.get()));
            else member.getRoles().forEach(role->contextual.addAll(builtIn("CALENDAR_"+role.name())));
        }
        if(global.contains(Permission.FINANCE_MEMBER_CALENDARS)) {
            contextual.add(Permission.FINANCE_VIEW);contextual.add(Permission.FINANCE_EXPORT);
        }
        contextual.retainAll(global);
        if(!contextual.contains(Permission.CALENDAR_VIEW))return Set.of();
        if(!contextual.contains(Permission.FINANCE_VIEW)) {
            contextual.remove(Permission.FINANCE_EXPORT);contextual.remove(Permission.FINANCE_MANAGE);
            contextual.remove(Permission.CATALOG_VIEW);contextual.remove(Permission.CATALOG_MANAGE);
        }
        if(!contextual.contains(Permission.CATALOG_VIEW))contextual.remove(Permission.CATALOG_MANAGE);
        if(!contextual.contains(Permission.FINANCE_VIEW_OWN))contextual.remove(Permission.FINANCE_MANAGE_OWN);
        return Set.copyOf(contextual);
    }
    public Optional<AccessAssignment> assigned(UUID user,UUID calendar) {
        return assignments.findByUserIdAndContextKey(user,AccessAssignment.key(calendar));
    }
    public Set<Permission> builtIn(String code) {
        return profiles.findByCode(code).map(profile->profile.isActive()?profile.getPermissions():Set.<Permission>of())
                .orElseGet(()->BuiltInProfiles.definition(code).permissions());
    }
    private Set<Permission> enabledPermissions(AccessAssignment assignment) {
        EnumSet<Permission> result=EnumSet.noneOf(Permission.class);
        assignment.getProfiles().stream().filter(AccessProfile::isActive).forEach(profile->result.addAll(profile.getPermissions()));
        return Set.copyOf(result);
    }
}

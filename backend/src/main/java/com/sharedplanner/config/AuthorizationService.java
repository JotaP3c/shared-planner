package com.sharedplanner.config;

import com.sharedplanner.access.Permission;
import com.sharedplanner.access.PermissionResolver;
import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.CalendarType;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventType;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class AuthorizationService {
    private final UserRepository userRepository;
    private final CalendarMemberRepository memberRepository;
    private final PermissionResolver resolver;
    public AuthorizationService(UserRepository users,CalendarMemberRepository members,PermissionResolver resolver) {
        this.userRepository=users;this.memberRepository=members;this.resolver=resolver;
    }
    public void ensureCalendarVisible(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.CALENDAR_VIEW,authentication); }
    public void ensureSystemAdmin(Authentication authentication) { ensureGlobalPermission(Permission.USERS_MANAGE,authentication); }
    public void ensureCanCreateCalendar(Authentication authentication) { ensureGlobalPermission(Permission.CALENDAR_CREATE,authentication); }
    public void ensureCanManageCalendar(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.MEMBERS_MANAGE,authentication); }
    public void ensureCanDelegateCalendarRoles(UUID calendarId,Set<CalendarMemberRole> roles,Authentication authentication) {
        Set<Permission> allowed=calendarPermissions(calendarId,authentication);
        EnumSet<Permission> requested=EnumSet.noneOf(Permission.class);
        roles.forEach(role->requested.addAll(resolver.builtIn("CALENDAR_"+role.name())));
        if(!allowed.containsAll(requested))throw denied("Cannot delegate permissions you do not hold");
    }
    public void ensureCanDelegateSystemRole(UserRole role,Authentication authentication) {
        String code=role==UserRole.ADMIN?"SYSTEM_ADMIN":role==UserRole.FINANCE?"SYSTEM_FINANCE":"USER";
        if(!globalPermissions(authentication).containsAll(resolver.builtIn(code)))
            throw denied("Cannot delegate permissions you do not hold");
    }
    public void ensureCanViewMembers(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.MEMBERS_VIEW,authentication); }
    public void ensureCanViewAuditLogs(UUID calendarId,Authentication authentication) {
        if(calendarId==null)ensureGlobalPermission(Permission.AUDIT_VIEW_ALL,authentication);
        else ensurePermission(calendarId,Permission.AUDIT_VIEW,authentication);
    }
    public void ensureCanCreateEvent(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.EVENT_CREATE,authentication); }
    public void ensureCanImportCalendar(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.CALENDAR_IMPORT,authentication); }
    public void ensureCanApproveEvent(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.EVENT_APPROVE,authentication); }
    public void ensureCanUseFinance(UUID calendarId,Authentication authentication) { ensurePermission(calendarId,Permission.FINANCE_VIEW,authentication); }
    public void ensureCanExportFinance(UUID calendarId,Authentication authentication) {
        ensurePermission(calendarId,Permission.FINANCE_VIEW,authentication);
        ensurePermission(calendarId,Permission.FINANCE_EXPORT,authentication);
    }
    public void ensureCanEditEvent(Event event,Authentication authentication) { ensureEventMutation(event,Permission.EVENT_EDIT,authentication); }
    public void ensureCanCancelEvent(Event event,Authentication authentication) { ensureEventMutation(event,Permission.EVENT_CANCEL,authentication); }
    public void ensureCanManagePayment(Event event,Authentication authentication) {
        Set<Permission> permissions=calendarPermissions(event.getCalendar().getId(),authentication);
        if(permissions.contains(Permission.FINANCE_MANAGE))return;
        if(permissions.contains(Permission.FINANCE_MANAGE_OWN)&&event.getCreatedBy().getEmail().equalsIgnoreCase(authentication.getName()))return;
        throw denied("You cannot manage this payment");
    }
    private void ensureEventMutation(Event event,Permission operation,Authentication authentication) {
        Set<Permission> permissions=calendarPermissions(event.getCalendar().getId(),authentication);
        if(!permissions.contains(operation))throw denied("You cannot change this event");
        if(permissions.contains(Permission.EVENT_EDIT_ALL)||event.getCreatedBy().getEmail().equalsIgnoreCase(authentication.getName()))return;
        if(event.getCalendar().getCalendarType()==CalendarType.LEGACY && event.getApprovalRound()==0
                && event.getEventType()==EventType.SHARED && event.getApprovalRequestedFrom()!=null
                && event.getApprovalRequestedFrom().getEmail().equalsIgnoreCase(authentication.getName()))return;
        throw denied("You cannot change this event");
    }
    public boolean hasGlobalPermission(Permission permission,Authentication authentication) { return globalPermissions(authentication).contains(permission); }
    public Set<Permission> globalPermissions(Authentication authentication) { return resolver.global(currentUser(authentication)); }
    public Set<Permission> calendarPermissions(UUID calendarId,Authentication authentication) {
        User user=currentUser(authentication);
        if(user.getRole()==UserRole.ADMIN)return Set.of(Permission.values());
        return resolver.contextual(user,requireMember(calendarId,authentication.getName()));
    }
    public Set<Permission> memberPermissions(User user,CalendarMember member) { return resolver.contextual(user,member); }
    public void ensureGlobalPermission(Permission permission,Authentication authentication) {
        if(!globalPermissions(authentication).contains(permission))throw denied("Missing permission: "+permission);
    }
    public void ensurePermission(UUID calendarId,Permission permission,Authentication authentication) {
        if(!calendarPermissions(calendarId,authentication).contains(permission))throw denied("Missing permission: "+permission);
    }
    public EventFinancialAccess resolveEventFinancialAccess(UUID calendarId,Authentication authentication) {
        User user=currentUser(authentication);
        if(user.getRole()==UserRole.ADMIN)return new EventFinancialAccess(true,false,authentication.getName());
        return memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId,authentication.getName()).map(member->{
            Set<Permission> permissions=resolver.contextual(user,member);
            return new EventFinancialAccess(permissions.contains(Permission.FINANCE_VIEW),permissions.contains(Permission.FINANCE_VIEW_OWN),authentication.getName());
        }).orElseGet(()->new EventFinancialAccess(false,false,authentication.getName()));
    }
    public record EventFinancialAccess(boolean canViewAll,boolean canViewOwn,String actorEmail) {
        public boolean canView(Event event) {
            return event.getEventType()==EventType.CLIENT&&(canViewAll||(canViewOwn&&event.getCreatedBy().getEmail().equalsIgnoreCase(actorEmail)));
        }
    }
    private User currentUser(Authentication authentication) {
        if(authentication==null||authentication.getName()==null||authentication.getName().isBlank())throw denied("Authentication required");
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found"));
    }
    private CalendarMember requireMember(UUID id,String email) {
        return memberRepository.findByCalendarIdAndUserEmailIgnoreCase(id,email)
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Calendar not found"));
    }
    private static ResponseStatusException denied(String message) { return new ResponseStatusException(HttpStatus.FORBIDDEN,message); }
}

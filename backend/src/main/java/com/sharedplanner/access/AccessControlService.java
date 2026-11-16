package com.sharedplanner.access;

import com.sharedplanner.audit.*;
import com.sharedplanner.calendar.*;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.*;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class AccessControlService {
    private final AccessProfileRepository profiles;
    private final AccessAssignmentRepository assignments;
    private final UserRepository users;
    private final CalendarMemberRepository members;
    private final SharedCalendarRepository calendars;
    private final PermissionResolver resolver;
    private final AuthorizationService authorization;
    private final AuditService audit;
    public AccessControlService(AccessProfileRepository profiles,AccessAssignmentRepository assignments,UserRepository users,
            CalendarMemberRepository members,SharedCalendarRepository calendars,PermissionResolver resolver,
            AuthorizationService authorization,AuditService audit) {
        this.profiles=profiles;this.assignments=assignments;this.users=users;this.members=members;this.calendars=calendars;
        this.resolver=resolver;this.authorization=authorization;this.audit=audit;
    }
    public record PermissionDefinition(String code,String module,String label,boolean globalOnly) { }
    public record ProfileResponse(UUID id,String code,String name,ProfileScope scope,boolean active,boolean builtIn,Set<Permission> permissions) {
        static ProfileResponse from(AccessProfile p) {return new ProfileResponse(p.getId(),p.getCode(),p.getName(),p.getScope(),p.isActive(),p.isBuiltIn(),p.getPermissions());}
    }
    public record CreateProfileRequest(@NotBlank @Size(max=120) String name,@NotNull ProfileScope scope,
            @NotNull Boolean active,@NotNull @Size(max=50) Set<@NotNull Permission> permissions) { }
    public record UpdateProfileRequest(@NotBlank @Size(max=120) String name,@NotNull Boolean active,
            @NotNull @Size(max=50) Set<@NotNull Permission> permissions) { }
    public record AssignmentRequest(@NotNull UUID userId,UUID calendarId,@NotNull @Size(max=20) Set<@NotNull UUID> profileIds) { }
    public record AssignmentResponse(UUID userId,UUID calendarId,Set<UUID> profileIds,boolean explicit) { }
    public record EffectiveCalendar(UUID calendarId,Set<UUID> profileIds,Set<Permission> permissions) { }
    public record EffectiveResponse(UUID userId,Set<UUID> profileIds,Set<Permission> globalPermissions,List<EffectiveCalendar> calendars) { }

    public List<PermissionDefinition> catalog(Authentication authentication) {
        actor(authentication);
        return Arrays.stream(Permission.values()).map(p->new PermissionDefinition(p.name(),p.module(),p.label(),p.globalOnly())).toList();
    }
    @Transactional
    public List<ProfileResponse> list(UUID calendarId,Authentication authentication) {
        if(calendarId==null)authorization.ensureGlobalPermission(Permission.ROLES_MANAGE,authentication);
        else authorization.ensureCanManageCalendar(calendarId,authentication);
        ensureBuiltIns();
        return profiles.findAllByOrderByScopeAscNameAsc().stream()
                .filter(profile->calendarId==null||profile.getScope()==ProfileScope.CALENDAR).map(ProfileResponse::from).toList();
    }
    @Transactional
    public ProfileResponse create(CreateProfileRequest request,Authentication authentication) {
        authorization.ensureGlobalPermission(Permission.ROLES_MANAGE,authentication);
        validatePermissions(request.scope(),request.permissions(),authentication);
        AccessProfile saved=profiles.save(new AccessProfile("CUSTOM_"+UUID.randomUUID(),request.name().trim(),request.scope(),false,request.permissions()));
        saved.update(request.name().trim(),request.active(),request.permissions());
        log(AuditEntityType.ACCESS_PROFILE,saved.getId(),null,AuditAction.CREATED,"Access profile created",null,snapshot(saved),actor(authentication));
        return ProfileResponse.from(saved);
    }
    @Transactional
    public ProfileResponse update(UUID profileId,UpdateProfileRequest request,Authentication authentication) {
        authorization.ensureGlobalPermission(Permission.ROLES_MANAGE,authentication);
        AccessProfile profile=profiles.findById(profileId).orElseThrow(()->notFound("Profile not found"));
        if(profile.getCode().equals("SYSTEM_ADMIN"))throw bad("The essential system administrator profile is protected");
        validatePermissions(profile.getScope(),request.permissions(),authentication);
        String old=snapshot(profile);
        profile.update(request.name().trim(),request.active(),request.permissions());
        log(AuditEntityType.ACCESS_PROFILE,profileId,null,AuditAction.UPDATED,"Access profile updated",old,snapshot(profile),actor(authentication));
        return ProfileResponse.from(profile);
    }
    @Transactional(readOnly=true)
    public List<UserResponse> users(Authentication authentication) {
        authorization.ensureGlobalPermission(Permission.ROLES_MANAGE,authentication);
        return users.findAllByOrderByFullNameAsc().stream().map(UserResponse::from).toList();
    }
    @Transactional
    public AssignmentResponse assignment(UUID userId,UUID calendarId,Authentication authentication) {
        User target=authorizedTarget(userId,calendarId,authentication,false);
        ensureBuiltIns();
        return assignmentResponse(target,calendarId);
    }
    @Transactional
    public AssignmentResponse assign(AssignmentRequest request,Authentication authentication) {
        User target=authorizedTarget(request.userId(),request.calendarId(),authentication,true);
        protectEssentialTarget(target,request.calendarId());
        List<AccessProfile> selected=profiles.findAllById(request.profileIds());
        if(selected.size()!=request.profileIds().size())throw bad("Unknown profile");
        ProfileScope required=request.calendarId()==null?ProfileScope.GLOBAL:ProfileScope.CALENDAR;
        if(selected.stream().anyMatch(p->p.getScope()!=required||!p.isActive()))throw bad("Only active profiles of the matching scope can be assigned");
        Set<Permission> allowed=request.calendarId()==null?authorization.globalPermissions(authentication)
                :authorization.calendarPermissions(request.calendarId(),authentication);
        if(selected.stream().anyMatch(p->!allowed.containsAll(p.getPermissions())))throw forbidden("Cannot delegate permissions you do not hold");
        if(selected.stream().anyMatch(p->p.getCode().equals("SYSTEM_ADMIN")))throw bad("Essential administrator access is managed by the protected user lifecycle");
        AccessAssignment assignment=resolver.assigned(target.getId(),request.calendarId())
                .orElseGet(()->new AccessAssignment(target.getId(),request.calendarId()));
        String old=assignment.getProfiles().stream().map(p->p.getId().toString()).sorted().toList().toString();
        assignment.assign(selected);assignments.save(assignment);
        log(AuditEntityType.ACCESS_ASSIGNMENT,assignment.getId(),request.calendarId(),AuditAction.UPDATED,
                "Access profiles assigned",old,request.profileIds().stream().map(UUID::toString).sorted().toList().toString(),actor(authentication));
        return new AssignmentResponse(target.getId(),request.calendarId(),Set.copyOf(request.profileIds()),true);
    }
    @Transactional
    public void restoreDefaults(UUID userId,UUID calendarId,Authentication authentication) {
        User target=authorizedTarget(userId,calendarId,authentication,true);
        protectEssentialTarget(target,calendarId);
        resolver.assigned(userId,calendarId).ifPresent(assignment->{
            if(calendarId==null) {
                String code=target.getRole()==UserRole.FINANCE?"SYSTEM_FINANCE":"USER";
                if(!authorization.globalPermissions(authentication).containsAll(resolver.builtIn(code)))
                    throw forbidden("Cannot restore permissions you do not hold");
            } else {
                CalendarMember member=members.findByCalendarIdAndUserId(calendarId,userId).orElseThrow(()->notFound("Calendar member not found"));
                authorization.ensureCanDelegateCalendarRoles(calendarId,member.getRoles(),authentication);
            }
            log(AuditEntityType.ACCESS_ASSIGNMENT,assignment.getId(),calendarId,AuditAction.UPDATED,
                    "Default access profiles restored",assignment.getProfiles().stream().map(AccessProfile::getCode).sorted().toList().toString(),
                    "legacy role mapping",actor(authentication));
            assignments.delete(assignment);
        });
    }
    @Transactional
    public EffectiveResponse effective(UUID requestedUserId,UUID calendarId,Authentication authentication) {
        User current=actor(authentication);
        User target=requestedUserId==null?current:authorizedTarget(requestedUserId,calendarId,authentication,false);
        ensureBuiltIns();
        List<EffectiveCalendar> effective;
        if(target.getRole()==UserRole.ADMIN) {
            effective=calendars.findAll().stream().filter(c->calendarId==null||c.getId().equals(calendarId))
                    .map(c->new EffectiveCalendar(c.getId(),profileIds(target,c.getId()),Set.of(Permission.values()))).toList();
        } else {
            effective=members.findByUserEmailIgnoreCase(target.getEmail()).stream()
                    .filter(m->calendarId==null||m.getCalendar().getId().equals(calendarId))
                    .map(m->new EffectiveCalendar(m.getCalendar().getId(),profileIds(target,m.getCalendar().getId()),resolver.contextual(target,m))).toList();
        }
        return new EffectiveResponse(target.getId(),profileIds(target,null),resolver.global(target),effective);
    }
    private User authorizedTarget(UUID userId,UUID calendarId,Authentication authentication,boolean mutation) {
        User current=actor(authentication);
        if(mutation||!current.getId().equals(userId)) {
            if(calendarId==null)authorization.ensureGlobalPermission(Permission.ROLES_MANAGE,authentication);
            else authorization.ensureCanManageCalendar(calendarId,authentication);
        }
        User target=users.findById(userId).orElseThrow(()->notFound("User not found"));
        if(calendarId!=null && members.findByCalendarIdAndUserId(calendarId,userId).isEmpty())throw notFound("Calendar member not found");
        return target;
    }
    private void protectEssentialTarget(User user,UUID calendarId) {
        if(user.getRole()==UserRole.ADMIN)throw bad("The essential system administrator access cannot be replaced");
        if(calendarId!=null) {
            CalendarMember member=members.findByCalendarIdAndUserId(calendarId,user.getId()).orElseThrow(()->notFound("Calendar member not found"));
            if(member.getCalendar().getOwner().getId().equals(user.getId()))throw bad("The calendar owner must retain contextual administration");
        }
    }
    private void validatePermissions(ProfileScope scope,Set<Permission> permissions,Authentication authentication) {
        if(scope==ProfileScope.CALENDAR&&permissions.stream().anyMatch(Permission::globalOnly))throw bad("A calendar profile cannot grant global system permissions");
        if(!authorization.globalPermissions(authentication).containsAll(permissions))throw forbidden("Cannot configure permissions you do not hold");
    }
    private AssignmentResponse assignmentResponse(User user,UUID calendarId) {
        return new AssignmentResponse(user.getId(),calendarId,profileIds(user,calendarId),resolver.assigned(user.getId(),calendarId).isPresent());
    }
    private Set<UUID> profileIds(User user,UUID calendarId) {
        Optional<AccessAssignment> assigned=resolver.assigned(user.getId(),calendarId);
        if(assigned.isPresent())return assigned.get().getProfiles().stream().map(AccessProfile::getId).collect(java.util.stream.Collectors.toUnmodifiableSet());
        Set<String> codes;
        if(calendarId==null)codes=Set.of(user.getRole()==UserRole.ADMIN?"SYSTEM_ADMIN":user.getRole()==UserRole.FINANCE?"SYSTEM_FINANCE":"USER");
        else if(user.getRole()==UserRole.ADMIN)codes=Set.of("CALENDAR_ADMIN");
        else codes=members.findByCalendarIdAndUserId(calendarId,user.getId()).map(m->m.getRoles().stream().map(r->"CALENDAR_"+r.name()).collect(java.util.stream.Collectors.toSet())).orElse(Set.of());
        return codes.stream().map(profiles::findByCode).flatMap(Optional::stream).map(AccessProfile::getId).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
    private void ensureBuiltIns() {
        for(BuiltInProfiles.Definition definition:BuiltInProfiles.definitions())if(profiles.findByCode(definition.code()).isEmpty())
            profiles.save(new AccessProfile(definition.code(),definition.name(),definition.scope(),true,definition.permissions()));
    }
    private User actor(Authentication authentication) {
        return users.findByEmailIgnoreCaseAndActiveTrue(authentication.getName()).orElseThrow(()->notFound("User not found"));
    }
    private String snapshot(AccessProfile p){return "code="+p.getCode()+"; name="+p.getName()+"; active="+p.isActive()+"; permissions="+p.getPermissions().stream().sorted().toList();}
    private void log(AuditEntityType type,UUID id,UUID calendarId,AuditAction action,String summary,String old,String next,User actor){audit.log(type,id,calendarId,action,summary,old,next,actor);}
    private static ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    private static ResponseStatusException forbidden(String message){return new ResponseStatusException(HttpStatus.FORBIDDEN,message);}
    private static ResponseStatusException notFound(String message){return new ResponseStatusException(HttpStatus.NOT_FOUND,message);}
}

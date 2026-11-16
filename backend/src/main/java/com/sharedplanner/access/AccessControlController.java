package com.sharedplanner.access;

import com.sharedplanner.user.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/access")
public class AccessControlController {
    private final AccessControlService service;
    public AccessControlController(AccessControlService service){this.service=service;}
    @GetMapping("/permissions")
    public List<AccessControlService.PermissionDefinition> permissions(Authentication auth){return service.catalog(auth);}
    @GetMapping("/profiles")
    public List<AccessControlService.ProfileResponse> profiles(@RequestParam(required=false) UUID calendarId,Authentication auth){return service.list(calendarId,auth);}
    @PostMapping("/profiles") @ResponseStatus(HttpStatus.CREATED)
    public AccessControlService.ProfileResponse create(@RequestBody @Valid AccessControlService.CreateProfileRequest request,Authentication auth){return service.create(request,auth);}
    @PutMapping("/profiles/{id}")
    public AccessControlService.ProfileResponse update(@PathVariable UUID id,@RequestBody @Valid AccessControlService.UpdateProfileRequest request,Authentication auth){return service.update(id,request,auth);}
    @GetMapping("/users")
    public List<UserResponse> users(Authentication auth){return service.users(auth);}
    @GetMapping("/assignments")
    public AccessControlService.AssignmentResponse assignments(@RequestParam UUID userId,@RequestParam(required=false) UUID calendarId,Authentication auth){return service.assignment(userId,calendarId,auth);}
    @PutMapping("/assignments")
    public AccessControlService.AssignmentResponse assign(@RequestBody @Valid AccessControlService.AssignmentRequest request,Authentication auth){return service.assign(request,auth);}
    @DeleteMapping("/assignments") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restore(@RequestParam UUID userId,@RequestParam(required=false) UUID calendarId,Authentication auth){service.restoreDefaults(userId,calendarId,auth);}
    @GetMapping("/effective")
    public AccessControlService.EffectiveResponse effective(@RequestParam(required=false) UUID userId,@RequestParam(required=false) UUID calendarId,Authentication auth){return service.effective(userId,calendarId,auth);}
}

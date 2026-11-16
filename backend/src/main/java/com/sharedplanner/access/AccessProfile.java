package com.sharedplanner.access;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "access_profiles")
public class AccessProfile {
    @Id private UUID id;
    @Column(nullable=false, unique=true, length=80) private String code;
    @Column(nullable=false, length=120) private String name;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private ProfileScope scope;
    @Column(nullable=false) private boolean active;
    @Column(name="built_in", nullable=false) private boolean builtIn;
    @ElementCollection(fetch=FetchType.EAGER)
    @CollectionTable(name="access_profile_permissions", joinColumns=@JoinColumn(name="profile_id"))
    @Enumerated(EnumType.STRING) @Column(name="permission", nullable=false, length=50)
    private Set<Permission> permissions = new HashSet<>();
    protected AccessProfile() { }
    public AccessProfile(String code, String name, ProfileScope scope, boolean builtIn, Set<Permission> permissions) {
        this.id=UUID.randomUUID();this.code=code;this.scope=scope;this.builtIn=builtIn;
        update(name,true,permissions);
    }
    public void update(String name, boolean active, Set<Permission> permissions) {
        this.name=name;this.active=active;this.permissions.clear();this.permissions.addAll(permissions);
    }
    public UUID getId(){return id;} public String getCode(){return code;} public String getName(){return name;}
    public ProfileScope getScope(){return scope;} public boolean isActive(){return active;} public boolean isBuiltIn(){return builtIn;}
    public Set<Permission> getPermissions(){return Set.copyOf(permissions);}
}

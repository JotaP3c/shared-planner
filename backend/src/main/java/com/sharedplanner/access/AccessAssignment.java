package com.sharedplanner.access;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name="access_assignments",uniqueConstraints=@UniqueConstraint(columnNames={"user_id","context_key"}))
public class AccessAssignment {
    @Id private UUID id;
    @Column(name="user_id",nullable=false) private UUID userId;
    @Column(name="calendar_id") private UUID calendarId;
    @Column(name="context_key",nullable=false,length=40) private String contextKey;
    @ManyToMany(fetch=FetchType.EAGER)
    @JoinTable(name="access_assignment_profiles",joinColumns=@JoinColumn(name="assignment_id"),inverseJoinColumns=@JoinColumn(name="profile_id"))
    private Set<AccessProfile> profiles=new HashSet<>();
    protected AccessAssignment() { }
    public AccessAssignment(UUID userId, UUID calendarId) {
        id=UUID.randomUUID();this.userId=userId;this.calendarId=calendarId;contextKey=key(calendarId);
    }
    public static String key(UUID calendarId) { return calendarId==null?"SYSTEM":calendarId.toString(); }
    public void assign(Collection<AccessProfile> values) { profiles.clear();profiles.addAll(values); }
    public UUID getId(){return id;} public UUID getUserId(){return userId;} public UUID getCalendarId(){return calendarId;}
    public Set<AccessProfile> getProfiles(){return Set.copyOf(profiles);}
}

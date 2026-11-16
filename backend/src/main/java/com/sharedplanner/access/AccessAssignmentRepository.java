package com.sharedplanner.access;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AccessAssignmentRepository extends JpaRepository<AccessAssignment,UUID> {
    Optional<AccessAssignment> findByUserIdAndContextKey(UUID userId,String contextKey);
    void deleteByUserIdAndContextKey(UUID userId,String contextKey);
}

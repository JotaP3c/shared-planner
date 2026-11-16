package com.sharedplanner.access;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AccessProfileRepository extends JpaRepository<AccessProfile,UUID> {
    Optional<AccessProfile> findByCode(String code);
    List<AccessProfile> findAllByOrderByScopeAscNameAsc();
}

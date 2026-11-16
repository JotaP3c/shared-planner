package com.sharedplanner.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCaseAndActiveTrue(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    long countByRoleAndActiveTrue(UserRole role);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role = :role and u.active = true order by u.id")
    List<User> findActiveAdministratorsForUpdate(@Param("role") UserRole role);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndActiveTrue(String email);

    List<User> findAllByOrderByFullNameAsc();
}

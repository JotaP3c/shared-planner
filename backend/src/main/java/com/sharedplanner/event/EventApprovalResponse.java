package com.sharedplanner.event;

import java.time.LocalDateTime;

public record EventApprovalResponse(String userEmail, EventApprovalStatus status, int round,
        LocalDateTime requestedAt, LocalDateTime respondedAt) {
    static EventApprovalResponse from(EventApproval approval) {
        return new EventApprovalResponse(approval.getUser().getEmail(), approval.getStatus(), approval.getRound(),
                approval.getRequestedAt(), approval.getRespondedAt());
    }
}

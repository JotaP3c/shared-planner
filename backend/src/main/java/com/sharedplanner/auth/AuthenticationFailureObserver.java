package com.sharedplanner.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.stereotype.Component;

/** Emits only an event type; principals, credentials and exception messages are excluded. */
@Component
public class AuthenticationFailureObserver {
    private static final Logger log=LoggerFactory.getLogger(AuthenticationFailureObserver.class);
    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent event) {
        log.warn("security_event=authentication_failure failure_type={}",event.getClass().getSimpleName());
    }
}

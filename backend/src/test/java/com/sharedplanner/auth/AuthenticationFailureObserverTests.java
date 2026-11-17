package com.sharedplanner.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class AuthenticationFailureObserverTests {
    @Test void emitsFailureTypeWithoutPrincipalPasswordOrExceptionContents(CapturedOutput output) {
        new AuthenticationFailureObserver().onFailure(new AuthenticationFailureBadCredentialsEvent(
                new UsernamePasswordAuthenticationToken("private-test-principal","private-test-password"),
                new BadCredentialsException("private-test-error")));
        assertThat(output).contains("security_event=authentication_failure","AuthenticationFailureBadCredentialsEvent")
                .doesNotContain("private-test-principal","private-test-password","private-test-error");
    }
}

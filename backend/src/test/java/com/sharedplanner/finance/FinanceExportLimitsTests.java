package com.sharedplanner.finance;

import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FinanceExportLimitsTests {
    AuthorizationService authorization = mock(AuthorizationService.class);
    SharedCalendarRepository calendars = mock(SharedCalendarRepository.class);
    FinanceExportEventRepository events = mock(FinanceExportEventRepository.class);
    FinanceService finance = mock(FinanceService.class);
    FinanceExportService exports = new FinanceExportService(authorization, calendars, events, finance);
    UUID calendar = UUID.randomUUID();
    LocalDate start = LocalDate.of(2026,11,1), end = LocalDate.of(2026,11,30);
    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("export-fixture@example.invalid", null);

    @Test
    void doesNotReadFinancialDataFromAnyCalendarWhenOneSelectionIsUnauthorized() {
        UUID denied = UUID.randomUUID();
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(authorization).ensureCanExportFinance(denied, auth);
        assertStatus(() -> exports.export(List.of(calendar, denied), start, end, auth), HttpStatus.FORBIDDEN);
        verify(authorization).ensureCanExportFinance(calendar, auth);
        verifyNoInteractions(events, calendars, finance);
    }

    @Test
    void rejectsMissingUnknownOrExcessiveCalendarSelection() {
        assertStatus(() -> exports.export(null, start, end, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(), start, end, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(Collections.singletonList(null), start, end, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(IntStream.range(0,21).mapToObj(i -> UUID.randomUUID()).toList(), start, end, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(Collections.nCopies(101, calendar), start, end, auth), HttpStatus.BAD_REQUEST);
        verifyNoInteractions(authorization, events, calendars, finance);
    }

    @Test
    void rejectsUnboundedReversedAndNonExcelDatePeriods() {
        assertStatus(() -> exports.export(List.of(calendar), null, end, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(calendar), start, null, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(calendar), end, start, auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(calendar), start, start.plusDays(1100), auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(calendar), LocalDate.of(1899,1,1), LocalDate.of(1899,1,1), auth), HttpStatus.BAD_REQUEST);
        assertStatus(() -> exports.export(List.of(calendar), LocalDate.MAX, LocalDate.MAX, auth), HttpStatus.BAD_REQUEST);
        verifyNoInteractions(authorization, events, calendars, finance);
    }

    @ParameterizedTest
    @CsvSource({"10001,0,0", "0,2000001,0", "1,40000,32768"})
    void refusesLargeReportsBeforeMaterializingEventBodies(long count, long characters, int maxCell) {
        var budget = mock(FinanceExportEventRepository.ExportBudget.class);
        when(budget.getAppointmentCount()).thenReturn(count);
        when(budget.getTextCharacters()).thenReturn(characters);
        when(budget.getLongestService()).thenReturn(maxCell);
        when(events.budget(anyList(), any(), any())).thenReturn(budget);
        assertStatus(() -> exports.export(List.of(calendar), start, end, auth), HttpStatus.PAYLOAD_TOO_LARGE);
        verify(events, never()).findExportEvents(anyList(), any(), any(), any());
        verifyNoInteractions(calendars, finance);
    }

    @Test
    void boundsCatalogRowsBeforeMaterializingAppointments() {
        var budget = mock(FinanceExportEventRepository.ExportBudget.class);
        when(events.budget(anyList(), any(), any())).thenReturn(budget);
        when(events.countExportItems(anyList(), any(), any())).thenReturn(20_001L);
        assertStatus(() -> exports.export(List.of(calendar), start, end, auth), HttpStatus.PAYLOAD_TOO_LARGE);
        verify(events, never()).findExportEvents(anyList(), any(), any(), any());
        verifyNoInteractions(calendars, finance);
    }

    @Test
    void boundedFetchNeverSilentlyTruncatesAnInconsistentOversizedResult() {
        var budget = mock(FinanceExportEventRepository.ExportBudget.class);
        when(budget.getAppointmentCount()).thenReturn(10000L);
        when(budget.getTextCharacters()).thenReturn(0L);
        when(budget.getLongestService()).thenReturn(0);
        when(events.budget(anyList(), any(), any())).thenReturn(budget);
        when(events.findExportEvents(anyList(), any(), any(), any())).thenReturn(Collections.nCopies(10001, mock(Event.class)));
        assertStatus(() -> exports.export(List.of(calendar), start, end, auth), HttpStatus.PAYLOAD_TOO_LARGE);
        verifyNoInteractions(calendars, finance);
    }

    @Test
    void rejectsSupplementaryUnicodeTextBeforeBuildingOrReadingFurtherReportData() {
        String oversized = "\uD83D\uDE00".repeat(20_000);
        assertThat(oversized.codePointCount(0, oversized.length())).isEqualTo(20_000);
        assertThat(oversized.length()).isEqualTo(40_000);
        var budget = mock(FinanceExportEventRepository.ExportBudget.class);
        // A PostgreSQL character-count budget accepts this string, while Excel cannot.
        when(budget.getAppointmentCount()).thenReturn(1L);
        when(budget.getTextCharacters()).thenReturn(20_000L);
        when(budget.getLongestService()).thenReturn(20_000);
        when(events.budget(anyList(), any(), any())).thenReturn(budget);
        Event appointment = mock(Event.class);
        SharedCalendar target = mock(SharedCalendar.class);
        when(appointment.getCalendar()).thenReturn(target);
        when(appointment.getWorkDescription()).thenReturn(oversized);
        when(events.findExportEvents(anyList(), any(), any(), any())).thenReturn(List.of(appointment));
        assertStatus(() -> exports.export(List.of(calendar), start, end, auth), HttpStatus.PAYLOAD_TOO_LARGE);
        verifyNoInteractions(calendars, finance);
    }

    @Test
    void appliesTheAggregateTextBudgetToUtf16UnitsAsWellAsDatabaseCodePoints() {
        String validCell = "\uD83D\uDE00".repeat(10_000);
        var budget = mock(FinanceExportEventRepository.ExportBudget.class);
        when(budget.getAppointmentCount()).thenReturn(101L);
        when(budget.getTextCharacters()).thenReturn(1_010_000L);
        when(budget.getLongestService()).thenReturn(10_000);
        when(events.budget(anyList(), any(), any())).thenReturn(budget);
        Event appointment = mock(Event.class);
        SharedCalendar target = mock(SharedCalendar.class);
        when(appointment.getCalendar()).thenReturn(target);
        when(appointment.getWorkDescription()).thenReturn(validCell);
        when(events.findExportEvents(anyList(), any(), any(), any())).thenReturn(Collections.nCopies(101, appointment));
        assertStatus(() -> exports.export(List.of(calendar), start, end, auth), HttpStatus.PAYLOAD_TOO_LARGE);
        verifyNoInteractions(calendars, finance);
    }

    private void assertStatus(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }
}

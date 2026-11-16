package com.sharedplanner.finance;

import com.sharedplanner.calendar.*;
import com.sharedplanner.event.*;
import com.sharedplanner.user.*;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Synthetic data only; all database changes roll back after each test. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "debug=false", "logging.level.root=ERROR"})
@Transactional
class FinanceExportIntegrationTests {
    private static final LocalDate START = LocalDate.of(2026, 11, 1), END = LocalDate.of(2026, 11, 30);
    @Autowired UserRepository users;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired EventRepository events;
    @Autowired FinanceExportService exports;
    @Autowired FinanceService finance;
    @Autowired MockMvc http;

    @Test
    void exportsFourSheetsNativeChartsAndTheSameScopedFinancialValuesAsDashboard() throws Exception {
        Fixture fixture = fixture();
        populated(fixture);
        var file = exports.export(List.of(fixture.left.getId(), fixture.right.getId(), fixture.left.getId()), START, END, fixture.auth);
        assertThat(file.filename()).isEqualTo("shared-planner-financial-report-2026-11.xlsx");
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertThat(book.sheetIterator()).toIterable().extracting(sheet -> sheet.getSheetName())
                    .containsExactly("Dashboard", "Appointments", "Payments", "Calendar Summary");
            var dashboard = book.getSheet("Dashboard");
            var summaryLeft = finance.summarize(fixture.left.getId(), START, END, fixture.auth);
            var summaryRight = finance.summarize(fixture.right.getId(), START, END, fixture.auth);
            assertThat(dashboard.getRow(6).getCell(0).getNumericCellValue()).isEqualTo(450);
            assertThat(dashboard.getRow(6).getCell(1).getNumericCellValue()).isEqualTo(210);
            assertThat(dashboard.getRow(6).getCell(2).getNumericCellValue()).isEqualTo(300);
            assertThat(dashboard.getRow(6).getCell(3).getNumericCellValue()).isEqualTo(5);
            assertThat(summaryLeft.expectedAmount().add(summaryRight.expectedAmount())).isEqualByComparingTo("450");
            assertThat(summaryLeft.receivedAmount().add(summaryRight.receivedAmount())).isEqualByComparingTo("210");
            assertThat(summaryLeft.pendingAmount().add(summaryRight.pendingAmount())).isEqualByComparingTo("300");
            assertThat(summaryLeft.containsSimulatedData()).isTrue();
            assertThat(summaryRight.containsSimulatedData()).isFalse();
            assertThat(dashboard.getRow(4).getCell(0).getStringCellValue()).contains("simulados");
            assertThat(dashboard.getDrawingPatriarch().getCharts()).hasSize(3);
            assertThat(dashboard.getDrawingPatriarch().getCharts().get(0).getCTChart().getPlotArea().sizeOfLineChartArray()).isEqualTo(1);
            for (int i = 1; i < 3; i++) {
                var donut = dashboard.getDrawingPatriarch().getCharts().get(i).getCTChart().getPlotArea().getDoughnutChartArray(0);
                assertThat(donut.getHoleSize().getVal()).isEqualTo((short) 70);
                assertThat(donut.getSerArray(0).getVal().getNumRef().getF()).contains("Dashboard!");
            }
            double paymentCount = 0, confirmationCount = 0, paymentPercent = 0, confirmationPercent = 0;
            for (int i = 49; i <= 52; i++) {
                paymentCount += dashboard.getRow(i).getCell(1).getNumericCellValue();
                confirmationCount += dashboard.getRow(i).getCell(6).getNumericCellValue();
                paymentPercent += dashboard.getRow(i).getCell(2).getNumericCellValue();
                confirmationPercent += dashboard.getRow(i).getCell(7).getNumericCellValue();
            }
            assertThat(paymentCount).isEqualTo(5); assertThat(confirmationCount).isEqualTo(5);
            assertThat(paymentPercent).isCloseTo(1, within(0.00001)); assertThat(confirmationPercent).isCloseTo(1, within(0.00001));

            var appointments = book.getSheet("Appointments");
            assertThat(appointments.getLastRowNum()).isEqualTo(5);
            assertThat(appointments.getRow(1).getCell(0).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(DateUtil.isCellDateFormatted(appointments.getRow(1).getCell(0))).isTrue();
            assertThat(appointments.getRow(1).getCell(0).getLocalDateTimeCellValue().toLocalDate()).isEqualTo(START.plusDays(1));
            assertThat(appointments.getRow(1).getCell(3).getCellType()).isEqualTo(CellType.STRING);
            assertThat(appointments.getRow(1).getCell(3).getStringCellValue()).startsWith("=HYPERLINK");
            assertThat(appointments.getRow(1).getCell(6).getCellStyle().getDataFormatString()).isEqualTo(FinanceWorkbook.BRL_FORMAT);
            assertThat(appointments.getRow(1).getCell(15).getStringCellValue()).contains("Sim");
            assertThat(appointments.getRow(1).getCell(16).getLocalDateTimeCellValue().toLocalDate()).isEqualTo(LocalDate.of(2026,11,12));
            assertThat(appointments.getRow(4).getCell(10).getNumericCellValue()).isZero();
            var payments = book.getSheet("Payments");
            assertThat(payments.getLastRowNum()).isEqualTo(4);
            double paid = 0;
            for (int i = 1; i <= payments.getLastRowNum(); i++) paid += payments.getRow(i).getCell(3).getNumericCellValue();
            assertThat(paid).isEqualTo(210);
            assertThat(payments.getRow(3).getCell(0).getCellType()).isEqualTo(CellType.BLANK);
            assertThat(payments.getRow(3).getCell(6).getStringCellValue()).contains("não disponíveis");
            assertThat(book.getSheet("Calendar Summary").getLastRowNum()).isEqualTo(2);
            for (var sheet : book) {
                if (!sheet.getSheetName().equals("Dashboard")) {
                    assertThat(((org.apache.poi.xssf.usermodel.XSSFSheet) sheet).getCTWorksheet().isSetAutoFilter()).isTrue();
                    assertThat(sheet.getPaneInformation().isFreezePane()).isTrue();
                }
                for (var row : sheet) for (var cell : row) assertThat(cell.getCellType()).isNotEqualTo(CellType.FORMULA);
            }
        }
        int chartParts = 0, images = 0;
        try (var zip = new ZipInputStream(new ByteArrayInputStream(file.content()))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (entry.getName().matches("xl/charts/chart\\d+\\.xml")) chartParts++;
                if (entry.getName().startsWith("xl/media/")) images++;
            }
        }
        assertThat(chartParts).isEqualTo(3); assertThat(images).isZero();
        Path sample = Path.of("target", "finance-export", "financial-report-synthetic.xlsx");
        Files.createDirectories(sample.getParent()); Files.write(sample, file.content());
    }

    @Test
    void emptyPeriodStillProducesValidSheetsChartsAndZeroTotals() throws Exception {
        Fixture fixture = fixture();
        var file = exports.export(List.of(fixture.left.getId()), START, END, fixture.auth);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertThat(book.getNumberOfSheets()).isEqualTo(4);
            assertThat(book.getSheet("Dashboard").getRow(6).getCell(0).getNumericCellValue()).isZero();
            assertThat(book.getSheet("Dashboard").getRow(10).getCell(0).getStringCellValue()).contains("Sem atendimentos");
            assertThat(book.getSheet("Dashboard").getDrawingPatriarch().getCharts()).hasSize(3);
            assertThat(book.getSheet("Appointments").getLastRowNum()).isZero();
            assertThat(book.getSheet("Payments").getLastRowNum()).isZero();
        }
    }

    @Test
    void preservesValidBmpAndSupplementaryTextAtExcelsUtf16BoundaryWithoutTruncation() throws Exception {
        Fixture fixture = fixture();
        // Varied deterministic text also keeps the valid workbook above POI's ZIP
        // inflate-ratio guard; that input security limit must not be weakened.
        var random = new java.util.Random(20261113L);
        StringBuilder bmpText = new StringBuilder(32_767);
        for (int index = 0; index < 32_767; index++) bmpText.append((char) (0x0100 + random.nextInt(256)));
        StringBuilder supplementaryText = new StringBuilder(32_767);
        for (int index = 0; index < 16_383; index++) supplementaryText.appendCodePoint(0x1F300 + random.nextInt(512));
        String bmp = bmpText.toString();
        String supplementary = supplementaryText.append('X').toString();
        assertThat(bmp.length()).isEqualTo(32_767);
        assertThat(supplementary.length()).isEqualTo(32_767);
        for (int index = 0; index < 2; index++) {
            Event event = client(fixture.left, fixture.owner, index + 2, 100, 0, PaymentStatus.PENDING);
            event.fill(EventType.CLIENT, EventStatus.SCHEDULED, "TEST ONLY Unicode boundary", "Synthetic client", null,
                    null, index == 0 ? bmp : supplementary, BigDecimal.valueOf(100), event.getStartsAt(), event.getEndsAt(), null, fixture.owner);
        }
        events.flush();
        var file = exports.export(List.of(fixture.left.getId()), START, END, fixture.auth);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            var sheet = book.getSheet("Appointments");
            assertThat(sheet.getLastRowNum()).isEqualTo(2);
            assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo(bmp);
            assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo(supplementary);
        }
    }

    @Test
    void exportUsesInclusiveCivilDatesAndPreservesPartialPeriodFilename() throws Exception {
        Fixture fixture = fixture();
        populated(fixture);
        var file = exports.export(List.of(fixture.left.getId()), START.plusDays(2), START.plusDays(2), fixture.auth);
        assertThat(file.filename()).isEqualTo("shared-planner-financial-report-2026-11-03_2026-11-03.xlsx");
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertThat(book.getSheet("Appointments").getLastRowNum()).isEqualTo(1);
            assertThat(book.getSheet("Dashboard").getRow(6).getCell(0).getNumericCellValue()).isEqualTo(200);
            assertThat(book.getSheet("Dashboard").getRow(6).getCell(1).getNumericCellValue()).isEqualTo(50);
            assertThat(book.getSheet("Dashboard").getRow(6).getCell(2).getNumericCellValue()).isEqualTo(150);
        }
    }

    @Test
    void deniesViewerOutsiderAndMixedUnauthorizedSelectionBeforeReturningAnyFile() {
        Fixture fixture = fixture();
        User viewer = users.save(new User("Export viewer", "export-viewer@example.invalid", "unused", UserRole.USER, null));
        members.save(new CalendarMember(fixture.left, viewer, CalendarMemberRole.VIEWER, fixture.owner));
        User outsider = users.save(new User("Export outsider", "export-outsider@example.invalid", "unused", UserRole.FINANCE, null));
        assertStatus(() -> exports.export(List.of(fixture.left.getId()), START, END, auth(viewer)), HttpStatus.FORBIDDEN);
        assertStatus(() -> exports.export(List.of(fixture.left.getId()), START, END, auth(outsider)), HttpStatus.NOT_FOUND);
        assertStatus(() -> exports.export(List.of(fixture.left.getId(), UUID.randomUUID()), START, END, fixture.auth), HttpStatus.NOT_FOUND);
    }

    @Test
    void httpEndpointReturnsAttachmentNoStoreAndRequiresAuthentication() throws Exception {
        Fixture fixture = fixture();
        http.perform(get("/api/finance/export").param("calendarIds", fixture.left.getId().toString())
                .param("startDate", START.toString()).param("endDate", END.toString())).andExpect(status().isUnauthorized());
        byte[] body = http.perform(get("/api/finance/export").with(user(fixture.owner.getEmail()))
                        .param("calendarIds", fixture.left.getId().toString()).param("startDate", START.toString()).param("endDate", END.toString()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"shared-planner-financial-report-2026-11.xlsx\""))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andReturn().getResponse().getContentAsByteArray();
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(body))) { assertThat(book.getNumberOfSheets()).isEqualTo(4); }
        User viewer = users.save(new User("REST viewer", "export-rest-viewer@example.invalid", "unused", UserRole.USER, null));
        members.save(new CalendarMember(fixture.left, viewer, CalendarMemberRole.VIEWER, fixture.owner));
        http.perform(get("/api/finance/export").with(user(viewer.getEmail()))
                .param("calendarIds", fixture.left.getId().toString()).param("startDate", START.toString()).param("endDate", END.toString()))
                .andExpect(status().isForbidden());
    }

    private Fixture fixture() {
        User owner = users.save(new User("Export synthetic owner", "export-owner@example.invalid", "unused", UserRole.FINANCE, null));
        User other = users.save(new User("Export synthetic other", "export-other@example.invalid", "unused", UserRole.USER, null));
        SharedCalendar left = calendars.save(new SharedCalendar("TEST ONLY — Export A", owner));
        SharedCalendar right = calendars.save(new SharedCalendar("TEST ONLY — Export B", other));
        members.save(new CalendarMember(left, owner, CalendarMemberRole.ADMIN, owner));
        members.save(new CalendarMember(right, other, CalendarMemberRole.ADMIN, other));
        members.save(new CalendarMember(right, owner, CalendarMemberRole.FINANCE, other));
        return new Fixture(owner, left, right, auth(owner));
    }
    private void populated(Fixture f) {
        Event paid = client(f.left, f.owner, 2, 100, 100, PaymentStatus.PAID);
        paid.confirmAppointment(f.owner); paid.markFinancialSimulation(LocalDate.of(2026,11,12));
        client(f.left, f.owner, 3, 200, 50, PaymentStatus.PARTIALLY_PAID);
        client(f.left, f.owner, 4, 80, 0, PaymentStatus.REFUNDED);
        client(f.right, f.owner, 5, 300, 60, PaymentStatus.PARTIALLY_PAID).unscheduleAppointment(UnscheduleReason.GAVE_UP, null, f.owner);
        Event moved = client(f.right, f.owner, 6, 70, 0, PaymentStatus.PENDING);
        moved.rescheduleAppointment(START.plusDays(5).atTime(11,0), START.plusDays(5).atTime(12,0), "TEST ONLY", f.owner);
        client(f.left, f.owner, 7, 999, 999, PaymentStatus.PAID).cancel(f.owner);
        Event outside = new Event(f.left, f.owner);
        var start = END.plusDays(1).atStartOfDay();
        outside.fill(EventType.CLIENT, EventStatus.SCHEDULED, "TEST ONLY excluded", "Synthetic", null, null, "Synthetic", BigDecimal.TEN,
                start, start.plusHours(1), null, f.owner); events.save(outside);
        Event personal = new Event(f.left, f.owner);
        personal.fill(EventType.PERSONAL, EventStatus.SCHEDULED, "TEST ONLY personal", null, "Synthetic", null, null, null,
                START.atTime(9,0), START.atTime(10,0), null, f.owner); events.save(personal);
        events.flush();
    }
    private Event client(SharedCalendar calendar, User owner, int day, int price, int received, PaymentStatus status) {
        Event event = new Event(calendar, owner);
        var start = LocalDate.of(2026,11,day).atTime(9,0);
        event.fill(EventType.CLIENT, EventStatus.SCHEDULED, "TEST ONLY export", "=HYPERLINK(\"https://example.invalid\",\"Synthetic\")", null,
                null, "+SUM(1,2) synthetic service", BigDecimal.valueOf(price), start, start.plusHours(1), null, owner);
        if (status != PaymentStatus.PENDING) event.registerPayment(status, status == PaymentStatus.REFUNDED ? null : PaymentMethod.PIX,
                BigDecimal.valueOf(received), status == PaymentStatus.REFUNDED ? null : start, owner);
        return events.save(event);
    }
    private UsernamePasswordAuthenticationToken auth(User actor) { return new UsernamePasswordAuthenticationToken(actor.getEmail(), null); }
    private void assertStatus(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }
    private record Fixture(User owner, SharedCalendar left, SharedCalendar right, UsernamePasswordAuthenticationToken auth) {}
}

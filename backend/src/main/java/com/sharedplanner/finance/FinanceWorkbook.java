package com.sharedplanner.finance;

import com.sharedplanner.event.AppointmentConfirmationStatus;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventStatus;
import com.sharedplanner.event.PaymentMethod;
import com.sharedplanner.event.PaymentStatus;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.*;
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** Writes native OOXML charts referencing editable worksheet cells, never chart images. */
final class FinanceWorkbook {
    static final String BRL_FORMAT = "\"R$\" #,##0.00";
    static final int MAX_CELL_CHARACTERS = 32767;
    private static final String[] PAYMENT_LABELS = {"Pago", "Parcialmente pago", "Pendente", "Reembolsado"};
    private static final String[] CONFIRMATION_LABELS = {"Confirmado", "Aguardando", "Desmarcado", "Remarcado"};

    record CalendarData(UUID id, String name, FinanceSummaryResponse summary, FinanceTimelineResponse timeline) {}

    byte[] write(LocalDate start, LocalDate end, List<CalendarData> calendars, List<Event> events) throws IOException {
        try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            book.getFontAt(0).setFontName("Aptos");
            book.getProperties().getCoreProperties().setTitle("Shared Planner — Relatório financeiro");
            book.getProperties().getCoreProperties().setCreator("Shared Planner");
            Styles styles = new Styles(book);
            XSSFSheet dashboard = book.createSheet("Dashboard");
            appointments(book.createSheet("Appointments"), styles, events);
            payments(book.createSheet("Payments"), styles, events);
            calendarSummary(book.createSheet("Calendar Summary"), styles, calendars);
            if (events.stream().anyMatch(event -> !event.getCatalogItems().isEmpty())) {
                catalogItems(book.createSheet("Item Details"), styles, events);
            }
            dashboard(dashboard, styles, start, end, calendars);
            book.setActiveSheet(0);
            book.write(output);
            return output.toByteArray();
        }
    }

    private void appointments(XSSFSheet sheet, Styles styles, List<Event> events) {
        String[] headers = {"Data", "Horário", "Calendário", "Cliente", "Serviço", "Duração (min)",
                "Valor", "Status do agendamento", "Status do pagamento", "Valor recebido", "Valor pendente",
                "Forma de pagamento", "Confirmação", "ID do atendimento", "Origem", "Valores simulados", "Referência da simulação"};
        header(sheet, 0, styles, headers);
        int index = 1;
        for (Event event : events) {
            Row row = sheet.createRow(index++);
            date(row, 0, event.getStartsAt(), styles.date);
            date(row, 1, event.getStartsAt(), styles.time);
            text(row, 2, event.getCalendar().getName());
            text(row, 3, event.getClientName());
            text(row, 4, event.getWorkDescription());
            number(row, 5, ChronoUnit.MINUTES.between(event.getStartsAt(), event.getEndsAt()), styles.integer);
            money(row, 6, event.getAmount(), styles);
            text(row, 7, scheduleLabel(event.getStatus()));
            text(row, 8, paymentLabel(event.getPaymentStatus()));
            money(row, 9, event.getReceivedAmount(), styles);
            money(row, 10, event.effectiveConfirmationStatus() == AppointmentConfirmationStatus.CANCELLED
                    ? BigDecimal.ZERO : amount(event.getAmount()).subtract(amount(event.getReceivedAmount())), styles);
            text(row, 11, methodLabel(event.getPaymentMethod()));
            text(row, 12, confirmationLabel(event.effectiveConfirmationStatus()));
            text(row, 13, event.getId().toString());
            text(row, 14, event.getExternalSource());
            text(row, 15, event.isFinancialSimulation() ? "Sim — desenvolvimento" : "Não");
            date(row, 16, event.getSimulationReferenceDate() == null ? null : event.getSimulationReferenceDate().atStartOfDay(), styles.date);
        }
        table(sheet, events.size(), headers.length);
        widths(sheet, 13, 11, 30, 28, 54, 17, 18, 26, 24, 20, 20, 23, 20, 39, 20, 26, 26);
    }

    private void catalogItems(XSSFSheet sheet, Styles styles, List<Event> events) {
        header(sheet, 0, styles, "Data", "Calendário", "Cliente", "ID do atendimento",
                "ID do item", "Produto/procedimento", "Quantidade", "Preço unitário aplicado",
                "Desconto total aplicado", "Subtotal", "Duração por unidade (min)");
        int index = 1;
        for (Event event : events) {
            for (var item : event.getCatalogItems()) {
                Row row = sheet.createRow(index++);
                date(row, 0, event.getStartsAt(), styles.datetime);
                text(row, 1, event.getCalendar().getName());
                text(row, 2, event.getClientName());
                text(row, 3, event.getId().toString());
                text(row, 4, item.catalogItemId().toString());
                text(row, 5, item.name());
                number(row, 6, item.quantity(), styles.integer);
                money(row, 7, item.unitPrice(), styles);
                money(row, 8, item.discount(), styles);
                money(row, 9, item.subtotal(), styles);
                if (item.durationMinutes() != null) number(row, 10, item.durationMinutes(), styles.integer);
            }
        }
        table(sheet, index - 1, 11);
        widths(sheet, 22, 30, 28, 39, 39, 45, 16, 26, 26, 20, 28);
    }

    private void payments(XSSFSheet sheet, Styles styles, List<Event> events) {
        header(sheet, 0, styles, "Data", "Calendário", "Atendimento", "Valor pago atual", "Forma de pagamento",
                "Status", "Informações de reembolso", "ID do atendimento", "Valores simulados", "Referência da simulação");
        int index = 1;
        for (Event event : events) {
            if (amount(event.getReceivedAmount()).signum() == 0 && event.getPaymentStatus() != PaymentStatus.REFUNDED) {
                continue;
            }
            Row row = sheet.createRow(index++);
            date(row, 0, event.getPaidAt(), styles.datetime);
            text(row, 1, event.getCalendar().getName());
            text(row, 2, event.getClientName());
            money(row, 3, event.getReceivedAmount(), styles);
            text(row, 4, methodLabel(event.getPaymentMethod()));
            text(row, 5, paymentLabel(event.getPaymentStatus()));
            text(row, 6, event.getPaymentStatus() == PaymentStatus.REFUNDED
                    ? "Reembolsado; data e valor histórico do reembolso não disponíveis no modelo"
                    : "Snapshot do valor recebido; não representa uma lista de transações");
            text(row, 7, event.getId().toString());
            text(row, 8, event.isFinancialSimulation() ? "Sim — desenvolvimento" : "Não");
            date(row, 9, event.getSimulationReferenceDate() == null ? null : event.getSimulationReferenceDate().atStartOfDay(), styles.date);
        }
        table(sheet, index - 1, 10);
        widths(sheet, 23, 30, 32, 22, 24, 24, 80, 39, 26, 26);
    }

    private void calendarSummary(XSSFSheet sheet, Styles styles, List<CalendarData> calendars) {
        header(sheet, 0, styles, "Calendário", "Total de atendimentos", "Receita prevista", "Receita recebida",
                "Receita pendente", "Confirmados", "Desmarcados", "Aguardando", "Remarcados", "ID do calendário", "Inclui simulação");
        int index = 1;
        for (CalendarData calendar : calendars) {
            FinanceSummaryResponse s = calendar.summary();
            Row row = sheet.createRow(index++);
            text(row, 0, calendar.name());
            number(row, 1, s.appointmentCount(), styles.integer);
            money(row, 2, s.expectedAmount(), styles);
            money(row, 3, s.receivedAmount(), styles);
            money(row, 4, s.pendingAmount(), styles);
            number(row, 5, s.confirmedCount(), styles.integer);
            number(row, 6, s.unscheduledCount(), styles.integer);
            number(row, 7, s.awaitingConfirmationCount(), styles.integer);
            number(row, 8, s.rescheduledCount(), styles.integer);
            text(row, 9, calendar.id().toString());
            text(row, 10, s.containsSimulatedData() ? "Sim — desenvolvimento" : "Não");
        }
        table(sheet, calendars.size(), 11);
        widths(sheet, 36, 25, 23, 23, 23, 18, 18, 18, 18, 39, 26);
    }

    private void dashboard(XSSFSheet sheet, Styles styles, LocalDate start, LocalDate end, List<CalendarData> calendars) {
        for (int column = 0; column < 16; column++) sheet.setColumnWidth(column, 14 * 256);
        Row title = sheet.createRow(0);
        title.setHeightInPoints(32);
        text(title, 0, "Shared Planner — Relatório financeiro").setCellStyle(styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 15));
        text(sheet.createRow(1), 0, "Calendários: " + String.join(", ", calendars.stream().map(CalendarData::name).toList()));
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 15));
        Row period = sheet.createRow(2);
        text(period, 0, "Período inclusivo");
        date(period, 2, start.atStartOfDay(), styles.date);
        date(period, 4, end.atStartOfDay(), styles.date);
        text(sheet.createRow(3), 0, "Receita por data do atendimento. Payments contém snapshots, sem histórico de transações/reembolsos.");
        sheet.addMergedRegion(new CellRangeAddress(3, 3, 0, 15));
        if (calendars.stream().anyMatch(calendar -> calendar.summary().containsSimulatedData())) {
            text(sheet.createRow(4), 0, "Inclui valores simulados de desenvolvimento. Não representam preços nem transações reais.");
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 0, 15));
        }

        BigDecimal expected = BigDecimal.ZERO, received = BigDecimal.ZERO, pending = BigDecimal.ZERO;
        long total = 0, confirmed = 0, awaiting = 0, cancelled = 0, rescheduled = 0, rescheduleHistory = 0;
        long[] payments = new long[4];
        Map<LocalDate, BigDecimal[]> timeline = new TreeMap<>();
        for (CalendarData calendar : calendars) {
            FinanceSummaryResponse summary = calendar.summary();
            expected = expected.add(summary.expectedAmount());
            received = received.add(summary.receivedAmount());
            pending = pending.add(summary.pendingAmount());
            total += summary.appointmentCount();
            confirmed += summary.confirmedCount();
            awaiting += summary.awaitingConfirmationCount();
            cancelled += summary.unscheduledCount();
            rescheduled += summary.rescheduledCount();
            rescheduleHistory += summary.rescheduleOccurrences();
            payments[0] += summary.paidCount(); payments[1] += summary.partiallyPaidCount();
            payments[2] += summary.pendingCount(); payments[3] += summary.refundedCount();
            for (FinanceTimelineResponse.Point point : calendar.timeline().points()) {
                BigDecimal[] values = timeline.computeIfAbsent(point.date(), ignored -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
                values[0] = values[0].add(point.expectedAmount());
                values[1] = values[1].add(point.receivedAmount());
            }
        }
        header(sheet, 5, styles, "Receita prevista", "Receita recebida", "Receita pendente", "Atendimentos");
        Row metrics = sheet.createRow(6);
        money(metrics, 0, expected, styles); money(metrics, 1, received, styles); money(metrics, 2, pending, styles);
        number(metrics, 3, total, styles.integer);
        header(sheet, 8, styles, "Confirmados", "Aguardando", "Desmarcados", "Remarcados", "Remarcações no histórico");
        Row confirmations = sheet.createRow(9);
        number(confirmations, 0, confirmed, styles.integer); number(confirmations, 1, awaiting, styles.integer);
        number(confirmations, 2, cancelled, styles.integer); number(confirmations, 3, rescheduled, styles.integer);
        number(confirmations, 4, rescheduleHistory, styles.integer);
        text(sheet.createRow(10), 0, total == 0 ? "Sem atendimentos no período selecionado." : "Gráficos nativos editáveis; dados de origem abaixo dos gráficos.");

        header(sheet, 48, styles, "Distribuição de pagamentos", "Quantidade", "Percentual");
        header(sheet, 48, 5, styles, "Confirmação atual", "Quantidade", "Percentual");
        long[] confirmationCounts = {confirmed, awaiting, cancelled, rescheduled};
        for (int i = 0; i < 4; i++) {
            Row row = sheet.createRow(49 + i);
            text(row, 0, PAYMENT_LABELS[i]); number(row, 1, payments[i], styles.integer);
            number(row, 2, total == 0 ? 0 : (double) payments[i] / total, styles.percent);
            text(row, 5, CONFIRMATION_LABELS[i]); number(row, 6, confirmationCounts[i], styles.integer);
            number(row, 7, total == 0 ? 0 : (double) confirmationCounts[i] / total, styles.percent);
        }
        header(sheet, 55, styles, "Data", "Receita prevista", "Receita recebida");
        int index = 56;
        for (var point : timeline.entrySet()) {
            Row row = sheet.createRow(index++);
            date(row, 0, point.getKey().atStartOfDay(), styles.date);
            money(row, 1, point.getValue()[0], styles); money(row, 2, point.getValue()[1], styles);
        }
        XSSFDrawing drawing = sheet.createDrawingPatriarch();
        lineChart(sheet, drawing, timeline.size(), calendars.get(0).timeline().granularity());
        doughnut(sheet, drawing, "Distribuição de pagamentos", 0, 8, 0, 1);
        doughnut(sheet, drawing, "Confirmação dos atendimentos", 8, 16, 5, 6);
        sheet.createFreezePane(0, 4);
        sheet.getPrintSetup().setLandscape(true);
        sheet.getPrintSetup().setFitWidth((short) 1);
        sheet.setFitToPage(true);
    }

    private void lineChart(XSSFSheet sheet, XSSFDrawing drawing, int count, FinanceTimelineResponse.Granularity granularity) {
        XSSFChart chart = drawing.createChart(drawing.createAnchor(0, 0, 0, 0, 0, 12, 16, 28));
        chart.setTitleText("Evolução da receita"); chart.setTitleOverlay(false);
        chart.getOrAddLegend().setPosition(LegendPosition.BOTTOM);
        XDDFDateAxis dates = chart.createDateAxis(AxisPosition.BOTTOM);
        dates.setNumberFormat(granularity == FinanceTimelineResponse.Granularity.DAY ? "dd/MM" : "MM/yyyy");
        XDDFValueAxis values = chart.createValueAxis(AxisPosition.LEFT);
        values.setNumberFormat(BRL_FORMAT);
        XDDFLineChartData data = (XDDFLineChartData) chart.createData(ChartTypes.LINE, dates, values);
        data.setVaryColors(false);
        data.setGrouping(Grouping.STANDARD);
        var categories = XDDFDataSourcesFactory.fromNumericCellRange(sheet, new CellRangeAddress(56, 55 + count, 0, 0));
        String[] titles = {"Receita prevista", "Receita recebida"};
        PresetColor[] colors = {PresetColor.ROYAL_BLUE, PresetColor.SEA_GREEN};
        for (int i = 0; i < 2; i++) {
            var source = XDDFDataSourcesFactory.fromNumericCellRange(sheet, new CellRangeAddress(56, 55 + count, i + 1, i + 1));
            XDDFLineChartData.Series series = (XDDFLineChartData.Series) data.addSeries(categories, source);
            series.setTitle(titles[i], null); series.setSmooth(false); series.setMarkerStyle(MarkerStyle.NONE);
            XDDFLineProperties line = new XDDFLineProperties(new XDDFSolidFillProperties(XDDFColor.from(colors[i])));
            line.setWidth(2.5);
            XDDFShapeProperties shape = new XDDFShapeProperties(); shape.setLineProperties(line);
            series.setShapeProperties(shape);
        }
        chart.plot(data);
    }

    private void doughnut(XSSFSheet sheet, XSSFDrawing drawing, String title, int firstCol, int lastCol,
                          int categoryCol, int countCol) {
        XSSFChart chart = drawing.createChart(drawing.createAnchor(0, 0, 0, 0, firstCol, 29, lastCol, 46));
        chart.setTitleText(title); chart.setTitleOverlay(false);
        chart.getOrAddLegend().setPosition(LegendPosition.BOTTOM);
        XDDFDoughnutChartData data = (XDDFDoughnutChartData) chart.createData(ChartTypes.DOUGHNUT, null, null);
        data.setHoleSize(70); data.setFirstSliceAngle(270); data.setVaryColors(true);
        data.addSeries(XDDFDataSourcesFactory.fromStringCellRange(sheet, new CellRangeAddress(49, 52, categoryCol, categoryCol)),
                XDDFDataSourcesFactory.fromNumericCellRange(sheet, new CellRangeAddress(49, 52, countCol, countCol))).setTitle(title, null);
        chart.plot(data);
        var labels = chart.getCTChart().getPlotArea().getDoughnutChartArray(0).addNewDLbls();
        labels.addNewShowPercent().setVal(true); labels.addNewShowVal().setVal(false);
        labels.addNewShowLegendKey().setVal(false); labels.addNewShowCatName().setVal(false);
        String[] colors = categoryCol == 0 ? new String[] {"16A34A", "2563EB", "D97706", "94A3B8"}
                : new String[] {"16A34A", "D97706", "94A3B8", "7C3AED"};
        var series = chart.getCTChart().getPlotArea().getDoughnutChartArray(0).getSerArray(0);
        for (int i = 0; i < colors.length; i++) {
            var point = series.addNewDPt(); point.addNewIdx().setVal(i);
            point.addNewSpPr().addNewSolidFill().addNewSrgbClr().setVal(java.util.HexFormat.of().parseHex(colors[i]));
        }
    }

    private void header(XSSFSheet sheet, int row, Styles styles, String... columns) { header(sheet, row, 0, styles, columns); }
    private void header(XSSFSheet sheet, int index, int firstColumn, Styles styles, String... columns) {
        Row row = sheet.getRow(index); if (row == null) row = sheet.createRow(index);
        row.setHeightInPoints(28);
        for (int i = 0; i < columns.length; i++) text(row, firstColumn + i, columns[i]).setCellStyle(styles.header);
    }
    private void table(XSSFSheet sheet, int rows, int columns) {
        sheet.setAutoFilter(new CellRangeAddress(0, rows, 0, columns - 1));
        sheet.createFreezePane(0, 1);
    }
    private void widths(XSSFSheet sheet, int... widths) {
        for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);
    }
    private Cell text(Row row, int column, String value) {
        Cell cell = row.createCell(column, CellType.STRING);
        // Explicit STRING cells, not formulas, also for text starting with =, +, -, @ or tab.
        String safe = value == null ? "" : value;
        if (safe.length() > MAX_CELL_CHARACTERS) {
            // The service validates export inputs first; never hide data loss if a future
            // caller omits that validation or introduces another unbounded text field.
            throw new IllegalArgumentException("Text exceeds Excel's 32767 UTF-16 character cell limit");
        }
        cell.setCellValue(safe);
        return cell;
    }
    private void date(Row row, int column, LocalDateTime date, CellStyle style) {
        Cell cell = row.createCell(column); cell.setCellStyle(style);
        if (date != null) cell.setCellValue(date);
    }
    private void number(Row row, int column, double value, CellStyle style) {
        Cell cell = row.createCell(column, CellType.NUMERIC); cell.setCellValue(value); cell.setCellStyle(style);
    }
    private void money(Row row, int column, BigDecimal value, Styles styles) { number(row, column, amount(value).doubleValue(), styles.money); }
    private BigDecimal amount(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private String scheduleLabel(EventStatus status) { return switch (status) {
        case SCHEDULED -> "Agendado"; case PENDING_APPROVAL -> "Aguardando aprovação";
        case APPROVED -> "Aprovado"; case REJECTED -> "Rejeitado"; case CANCELLED -> "Cancelado";
    }; }
    private String paymentLabel(PaymentStatus status) { return switch (status) {
        case PAID -> PAYMENT_LABELS[0]; case PARTIALLY_PAID -> PAYMENT_LABELS[1];
        case PENDING -> PAYMENT_LABELS[2]; case REFUNDED -> PAYMENT_LABELS[3];
    }; }
    private String confirmationLabel(AppointmentConfirmationStatus status) { return switch (status) {
        case CONFIRMED -> CONFIRMATION_LABELS[0]; case PENDING_CONFIRMATION -> CONFIRMATION_LABELS[1];
        case CANCELLED -> CONFIRMATION_LABELS[2]; case RESCHEDULED -> CONFIRMATION_LABELS[3];
    }; }
    private String methodLabel(PaymentMethod method) {
        if (method == null) return "";
        return switch (method) {
            case CASH -> "Dinheiro"; case PIX -> "PIX"; case CREDIT_CARD -> "Cartão de crédito";
            case DEBIT_CARD -> "Cartão de débito"; case BANK_TRANSFER -> "Transferência bancária";
            case MERCADO_PAGO -> "Mercado Pago"; case OTHER -> "Outro";
        };
    }

    private static final class Styles {
        final CellStyle header, title, money, date, time, datetime, integer, percent;
        Styles(XSSFWorkbook book) {
            Font heading = book.createFont(); heading.setFontName("Aptos"); heading.setBold(true); heading.setColor(IndexedColors.WHITE.getIndex());
            header = book.createCellStyle(); header.setFont(heading);
            header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex()); header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setVerticalAlignment(VerticalAlignment.CENTER); header.setWrapText(true);
            Font titleFont = book.createFont(); titleFont.setFontName("Aptos"); titleFont.setBold(true); titleFont.setFontHeightInPoints((short) 20);
            title = book.createCellStyle(); title.setFont(titleFont);
            money = format(book, BRL_FORMAT); date = format(book, "dd/mm/yyyy"); time = format(book, "hh:mm");
            datetime = format(book, "dd/mm/yyyy hh:mm"); integer = format(book, "0"); percent = format(book, "0.0%");
        }
        private CellStyle format(XSSFWorkbook book, String pattern) {
            CellStyle style = book.createCellStyle(); style.setDataFormat(book.createDataFormat().getFormat(pattern)); return style;
        }
    }
}

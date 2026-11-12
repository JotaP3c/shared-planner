package com.sharedplanner.recurrence;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Component
public class RecurrenceEngine {
    public static final int MAX_OCCURRENCES = 366;

    public List<LocalDateTime> expand(LocalDateTime first, RecurrenceRule rule) {
        if (first == null || rule == null || rule.frequency() == null) throw bad("Informe a regra de recorrência.");
        if (rule.until() == null && rule.count() == null) throw bad("Informe a data final ou a quantidade de ocorrências.");
        if (rule.count() != null && (rule.count() < 1 || rule.count() > MAX_OCCURRENCES)) throw bad("A série permite de 1 a 366 ocorrências.");
        int interval = rule.frequency() == RecurrenceRule.Frequency.BIWEEKLY ? 2 : rule.interval() == null ? 1 : rule.interval();
        if (interval < 1 || interval > 52) throw bad("O intervalo deve estar entre 1 e 52.");
        ZoneId zone = zone(rule.zoneId());
        LocalDate last = rule.until() == null ? first.toLocalDate().plusYears(3) : rule.until();
        if (last.isBefore(first.toLocalDate()) || last.isAfter(first.toLocalDate().plusYears(3))) throw bad("A série deve terminar em até três anos.");
        Set<DayOfWeek> days = rule.weekDays() == null || rule.weekDays().isEmpty() ? Set.of(first.getDayOfWeek()) : rule.weekDays();
        if (days.stream().anyMatch(Objects::isNull)) throw bad("Selecione dias da semana válidos.");
        List<LocalDateTime> result = new ArrayList<>();
        for (LocalDate date = first.toLocalDate(); !date.isAfter(last); date = date.plusDays(1)) {
            if (!matches(first.toLocalDate(), date, rule.frequency(), interval, days)) continue;
            LocalDateTime candidate = date.atTime(first.toLocalTime());
            requireValidLocalTime(candidate, zone);
            result.add(candidate);
            if (result.size() > MAX_OCCURRENCES) throw bad("A regra gera mais de 366 ocorrências. Reduza o intervalo selecionado.");
            if (rule.count() != null && result.size() == rule.count()) break;
        }
        if (result.isEmpty()) throw bad("A regra não gera ocorrências no período.");
        if (rule.count() != null && rule.until() == null && result.size() < rule.count()) throw bad("A quantidade excede o limite de três anos.");
        return List.copyOf(result);
    }

    public static boolean matches(LocalDate first, LocalDate candidate, RecurrenceRule.Frequency frequency, int interval, Set<DayOfWeek> days) {
        if (candidate.isBefore(first)) return false;
        return switch (frequency) {
            case DAILY -> ChronoUnit.DAYS.between(first, candidate) % interval == 0;
            case WEEKLY, BIWEEKLY, CUSTOM -> {
                LocalDate baseWeek = first.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                LocalDate candidateWeek = candidate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                yield ChronoUnit.WEEKS.between(baseWeek, candidateWeek) % interval == 0 && days.contains(candidate.getDayOfWeek());
            }
            case MONTHLY -> candidate.getDayOfMonth() == first.getDayOfMonth()
                    && ChronoUnit.MONTHS.between(YearMonth.from(first), YearMonth.from(candidate)) % interval == 0;
            case YEARLY -> candidate.getMonth() == first.getMonth()
                    && candidate.getDayOfMonth() == first.getDayOfMonth()
                    && (candidate.getYear() - first.getYear()) % interval == 0;
        };
    }

    public static ZoneId zone(String value) {
        try { return ZoneId.of(value); }
        catch (Exception exception) { throw bad("Informe um fuso horário IANA válido."); }
    }

    public static void requireValidLocalTime(LocalDateTime value, ZoneId zone) {
        if (zone.getRules().getValidOffsets(value).isEmpty()) throw bad("A recorrência contém um horário inexistente na mudança de fuso.");
    }

    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}

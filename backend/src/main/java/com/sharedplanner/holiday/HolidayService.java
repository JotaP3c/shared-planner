package com.sharedplanner.holiday;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
public class HolidayService {
    public static final String SOURCE = "https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026";

    public HolidayCalendarResponse calendar(String country, int year) {
        String normalized = country == null ? "BR" : country.trim().toUpperCase(Locale.ROOT);
        // Never build a resource path from arbitrary request text.
        if (!normalized.equals("BR") || year != 2026) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Holiday calendar not available for this country/year");
        }
        String calendarId = "system:holidays:" + normalized + ":" + year;
        try (var stream = new ClassPathResource("holidays/BR-2026.txt").getInputStream();
             var reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            List<HolidayCalendarResponse.Holiday> holidays = reader.lines()
                    .filter(line -> !line.isBlank() && !line.startsWith("#"))
                    .map(line -> {
                        String[] fields = line.split("\\|", 2);
                        LocalDate date = LocalDate.parse(fields[0]);
                        return new HolidayCalendarResponse.Holiday(calendarId + ":" + date,
                                fields[1], date, date.plusDays(1), SOURCE);
                    }).toList();
            return new HolidayCalendarResponse(calendarId, "Feriados no Brasil", normalized, year, holidays);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot load the holiday catalog", exception);
        }
    }
}

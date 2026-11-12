package com.sharedplanner.holiday;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HolidayServiceTests {
    private final HolidayService service = new HolidayService();

    @Test
    void nationalCalendarExcludesOptionalStateAndMunicipalDays() {
        var calendar = service.calendar("br", 2026);
        assertThat(calendar.holidays()).hasSize(10);
        assertThat(calendar.holidays()).extracting(HolidayCalendarResponse.Holiday::startDate)
                .contains(LocalDate.of(2026, 4, 3), LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 25))
                .doesNotContain(LocalDate.of(2026, 2, 17), LocalDate.of(2026, 6, 4), LocalDate.of(2026, 10, 30));
    }

    @Test
    void allDayEndIsExclusiveAndIdsRemainStableAcrossRequests() {
        var first = service.calendar("BR", 2026);
        assertThat(service.calendar(" BR ", 2026)).isEqualTo(first);
        assertThat(first.holidays()).extracting(HolidayCalendarResponse.Holiday::id).doesNotHaveDuplicates();
        assertThat(first.holidays()).allSatisfy(holiday -> {
            assertThat(holiday.endDateExclusive()).isEqualTo(holiday.startDate().plusDays(1));
            assertThat(holiday.sourceUrl()).startsWith("https://www.gov.br/");
        });
    }

    @Test
    void unavailableYearsAndCountriesDoNotInventDatesOrReadArbitraryPaths() {
        for (String country : new String[]{"US", "../BR", ""}) {
            assertThatThrownBy(() -> service.calendar(country, 2026))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        }
        assertThatThrownBy(() -> service.calendar("BR", 2027)).isInstanceOf(ResponseStatusException.class);
    }
}

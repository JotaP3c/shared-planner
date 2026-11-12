package com.sharedplanner.recurrence;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;

class RecurrenceEngineTests {
    private final RecurrenceEngine engine=new RecurrenceEngine();
    private RecurrenceRule rule(RecurrenceRule.Frequency frequency,Integer interval,Set<DayOfWeek> days,LocalDate until,Integer count) {
        return new RecurrenceRule(frequency,interval,days,until,count,"America/Sao_Paulo");
    }
    @Test void createsMondayAndWednesdayOccurrencesWithoutInfiniteMaterialization() {
        var values=engine.expand(LocalDateTime.of(2026,10,5,16,0),rule(RecurrenceRule.Frequency.WEEKLY,1,Set.of(DayOfWeek.MONDAY,DayOfWeek.WEDNESDAY),LocalDate.of(2026,10,14),null));
        assertThat(values).containsExactly(LocalDateTime.of(2026,10,5,16,0),LocalDateTime.of(2026,10,7,16,0),LocalDateTime.of(2026,10,12,16,0),LocalDateTime.of(2026,10,14,16,0));
    }
    @Test void supportsDailyBiweeklyAndCustomIntervals() {
        var first=LocalDateTime.of(2026,11,2,16,0);
        assertThat(engine.expand(first,rule(RecurrenceRule.Frequency.DAILY,1,null,null,3))).containsExactly(first,first.plusDays(1),first.plusDays(2));
        assertThat(engine.expand(first,rule(RecurrenceRule.Frequency.BIWEEKLY,null,null,null,3))).containsExactly(first,first.plusWeeks(2),first.plusWeeks(4));
        assertThat(engine.expand(first,rule(RecurrenceRule.Frequency.CUSTOM,3,Set.of(DayOfWeek.MONDAY),null,2))).containsExactly(first,first.plusWeeks(3));
    }
    @Test void skipsInvalidMonthDaysInsteadOfMovingTheAppointment() {
        var first=LocalDateTime.of(2026,10,31,10,0);
        assertThat(engine.expand(first,rule(RecurrenceRule.Frequency.MONTHLY,1,null,LocalDate.of(2026,12,31),null))).containsExactly(first,LocalDateTime.of(2026,12,31,10,0));
    }
    @Test void rejectsUnboundedTooLargeAndNonexistentDstTimes() {
        var first=LocalDateTime.of(2026,1,1,10,0);
        assertThatThrownBy(()->engine.expand(first,rule(RecurrenceRule.Frequency.DAILY,1,null,null,null))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(()->engine.expand(first,rule(RecurrenceRule.Frequency.DAILY,1,null,LocalDate.of(2028,1,1),null))).isInstanceOf(ResponseStatusException.class);
        var dst=new RecurrenceRule(RecurrenceRule.Frequency.DAILY,1,null,null,2,"America/New_York");
        assertThatThrownBy(()->engine.expand(LocalDateTime.of(2026,3,7,2,30),dst)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("inexistente");
    }
}

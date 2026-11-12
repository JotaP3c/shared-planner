package com.sharedplanner.calendarimport;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.*;

class IcalendarParserTests {
    private final IcalendarParser parser=new IcalendarParser();
    private java.util.List<IcalendarParser.Item> parse(String events) {
        return parser.parse("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"+events+"END:VCALENDAR\r\n",ZoneId.of("America/Sao_Paulo"),LocalDate.of(2026,10,1),LocalDate.of(2026,12,31));
    }
    @Test void preservesUtcTimeDescriptionEscapesAndUnfoldedTitle() {
        var rows=parse("BEGIN:VEVENT\r\nUID:fixture-1\r\nDTSTART:20261001T130000Z\r\nDTEND:20261001T140000Z\r\nSUMMARY:Synthetic\r\n  event\r\nDESCRIPTION:Line one\\nLine two\\, ok\r\nEND:VEVENT\r\n");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).startsAt()).isEqualTo(LocalDateTime.of(2026,10,1,10,0));
        assertThat(rows.get(0).title()).isEqualTo("Synthetic event");
        assertThat(rows.get(0).description()).isEqualTo("Line one\nLine two, ok");
        assertThat(rows.get(0).issue()).isNull();
    }
    @Test void preservesAllDayExclusiveEndAndRfcDefaultOneDay() {
        var row=parse("BEGIN:VEVENT\r\nUID:fixture-day\r\nDTSTART;VALUE=DATE:20261225\r\nSUMMARY:Synthetic day\r\nEND:VEVENT\r\n").get(0);
        assertThat(row.allDay()).isTrue();
        assertThat(row.startsAt()).isEqualTo(LocalDate.of(2026,12,25).atStartOfDay());
        assertThat(row.endsAt()).isEqualTo(LocalDate.of(2026,12,26).atStartOfDay());
    }
    @Test void appliesExceptionsAdditionalDatesAndCancelledOverrideOnce() {
        var rows=parse("""
                BEGIN:VEVENT
                UID:fixture-series
                DTSTART;TZID=America/Sao_Paulo:20261005T160000
                DTEND;TZID=America/Sao_Paulo:20261005T170000
                SUMMARY:Synthetic weekly
                RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
                EXDATE;TZID=America/Sao_Paulo:20261007T160000
                RDATE;TZID=America/Sao_Paulo:20261009T160000
                END:VEVENT
                BEGIN:VEVENT
                UID:fixture-series
                RECURRENCE-ID;TZID=America/Sao_Paulo:20261012T160000
                DTSTART;TZID=America/Sao_Paulo:20261013T180000
                DTEND;TZID=America/Sao_Paulo:20261013T190000
                SUMMARY:Synthetic moved
                END:VEVENT
                BEGIN:VEVENT
                UID:fixture-series
                RECURRENCE-ID;TZID=America/Sao_Paulo:20261014T160000
                STATUS:CANCELLED
                END:VEVENT
                """);
        assertThat(rows).hasSize(4);
        assertThat(rows).allMatch(row->row.issue()==null);
        assertThat(rows).extracting(IcalendarParser.Item::startsAt).contains(LocalDateTime.of(2026,10,13,18,0)).doesNotContain(LocalDateTime.of(2026,10,7,16,0));
        assertThat(rows.stream().filter(IcalendarParser.Item::cancelled)).hasSize(1);
        assertThat(rows).extracting(IcalendarParser.Item::recurrenceId).doesNotHaveDuplicates();
    }
    @Test void neverGuessesMissingEndOwnerOrUnsupportedRules() {
        var missing=parse("BEGIN:VEVENT\nUID:missing-end\nSUMMARY:Synthetic\nDTSTART:20261101T100000\nEND:VEVENT\n").get(0);
        assertThat(missing.issue()).contains("não será inventado");
        var unsupported=parse("BEGIN:VEVENT\nUID:unsupported\nSUMMARY:Synthetic\nDTSTART:20261101T100000\nDTEND:20261101T110000\nRRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO\nEND:VEVENT\n").get(0);
        assertThat(unsupported.issue()).contains("não suportadas");
        assertThat(unsupported.startsAt()).isNull();
    }
    @Test void blocksPrivateEventsAndUnknownTimezone() {
        var privateItem=parse("BEGIN:VEVENT\nUID:private-fixture\nCLASS:PRIVATE\nSUMMARY:Synthetic private\nDTSTART:20261101T100000\nDTEND:20261101T110000\nEND:VEVENT\n").get(0);
        assertThat(privateItem.issue()).contains("privado");
        var timezone=parse("BEGIN:VEVENT\nUID:zone-fixture\nSUMMARY:Synthetic\nDTSTART;TZID=Invalid/Zone:20261101T100000\nDTEND;TZID=Invalid/Zone:20261101T110000\nEND:VEVENT\n").get(0);
        assertThat(timezone.issue()).contains("fuso");
    }
    @Test void limitsAnOtherwiseInfiniteSeriesToTheRequestedWindow() {
        var rows=parse("BEGIN:VEVENT\nUID:bounded-fixture\nSUMMARY:Synthetic weekly\nDTSTART:20201005T160000\nDURATION:PT1H\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\nEND:VEVENT\n");
        assertThat(rows).hasSizeBetween(20,30).allMatch(row->row.startsAt()!=null&&row.startsAt().getYear()==2026);
        assertThat(rows).extracting(IcalendarParser.Item::recurrenceId).doesNotHaveDuplicates();
    }

    @Test void anOverrideWithoutStatusInheritsItsCancelledMaster() {
        var rows=parse("""
                BEGIN:VEVENT
                UID:cancelled-master
                SUMMARY:Synthetic cancelled series
                DTSTART:20261102T100000
                DTEND:20261102T110000
                STATUS:CANCELLED
                RRULE:FREQ=DAILY;COUNT=2
                END:VEVENT
                BEGIN:VEVENT
                UID:cancelled-master
                RECURRENCE-ID:20261103T100000
                DTSTART:20261103T120000
                DTEND:20261103T130000
                END:VEVENT
                """);
        assertThat(rows).hasSize(2).allMatch(IcalendarParser.Item::cancelled);
    }

    @Test void rejectsInvalidDatesInsteadOfNormalizingThemToAnotherDay() {
        var row=parse("BEGIN:VEVENT\nUID:invalid-date\nSUMMARY:Synthetic\nDTSTART:20261131T100000\nDTEND:20261131T110000\nEND:VEVENT\n").get(0);
        assertThat(row.issue()).isNotBlank();
        assertThat(row.startsAt()).isNull();
    }

    @Test void yearlyBirthdaysProduceOnlyExactAllDayDatesWithinTheWindow() {
        String input="BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture-birthday\nSUMMARY:Synthetic birthday\nDTSTART;VALUE=DATE:20001115\nDTEND;VALUE=DATE:20001116\nRRULE:FREQ=YEARLY\nEND:VEVENT\nEND:VCALENDAR\n";
        var rows=parser.parse(input,ZoneId.of("America/Sao_Paulo"),LocalDate.of(2026,11,15),LocalDate.of(2027,11,15));
        assertThat(rows).hasSize(2).allMatch(row->row.issue()==null&&row.allDay());
        assertThat(rows).extracting(IcalendarParser.Item::startsAt).containsExactly(LocalDate.of(2026,11,15).atStartOfDay(),LocalDate.of(2027,11,15).atStartOfDay());
        assertThat(rows).allSatisfy(row->assertThat(row.endsAt()).isEqualTo(row.startsAt().plusDays(1)));
    }

    @Test void yearlyLeapDayDoesNotInventAnOccurrenceOnFebruary28() {
        String input="BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture-leap\nSUMMARY:Synthetic leap birthday\nDTSTART;VALUE=DATE:20000229\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29\nEND:VEVENT\nEND:VCALENDAR\n";
        var common=parser.parse(input,ZoneId.of("America/Sao_Paulo"),LocalDate.of(2027,1,1),LocalDate.of(2027,12,31));
        var leap=parser.parse(input,ZoneId.of("America/Sao_Paulo"),LocalDate.of(2028,1,1),LocalDate.of(2028,12,31));
        assertThat(common).isEmpty();
        assertThat(leap).hasSize(1);
        assertThat(leap.get(0).startsAt()).isEqualTo(LocalDate.of(2028,2,29).atStartOfDay());
    }

    @Test void preservesSundayWeekStartForBiweeklyGoogleRules() {
        var rows=parse("BEGIN:VEVENT\nUID:fixture-wkst\nSUMMARY:Synthetic Sunday weeks\nDTSTART:20261101T100000\nDTEND:20261101T110000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;WKST=SU;COUNT=4\nEND:VEVENT\n");
        assertThat(rows).hasSize(4).allMatch(row->row.issue()==null);
        assertThat(rows).extracting(IcalendarParser.Item::startsAt).containsExactly(LocalDateTime.of(2026,11,1,10,0),LocalDateTime.of(2026,11,2,10,0),LocalDateTime.of(2026,11,15,10,0),LocalDateTime.of(2026,11,16,10,0));
    }

    @Test void floatingOccurrenceIdentityDoesNotDependOnTheDisplayZone() {
        String input="BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture-floating\nSUMMARY:Synthetic floating\nDTSTART:20261102T100000\nDTEND:20261102T110000\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\nEND:VCALENDAR\n";
        var local=parser.parse(input,ZoneId.of("America/Sao_Paulo"),LocalDate.of(2026,11,1),LocalDate.of(2026,11,30));
        var utc=parser.parse(input,ZoneId.of("UTC"),LocalDate.of(2026,11,1),LocalDate.of(2026,11,30));
        assertThat(local).extracting(IcalendarParser.Item::recurrenceId).containsExactlyElementsOf(utc.stream().map(IcalendarParser.Item::recurrenceId).toList());
        assertThat(local.get(0).recurrenceId()).startsWith("FLOAT:");
    }

    @Test void explicitlyAuthorizedPrivateYearlyAllDayEventsRetainTheirDates() {
        String input="BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture-private-birthday\nCLASS:PRIVATE\nSUMMARY:Synthetic private birthday\nDTSTART;VALUE=DATE:20001115\nDTEND;VALUE=DATE:20001116\nRRULE:FREQ=YEARLY\nEND:VEVENT\nEND:VCALENDAR\n";
        var from=LocalDate.of(2026,1,1);var until=LocalDate.of(2026,12,31);var zone=ZoneId.of("America/Sao_Paulo");
        assertThat(parser.parse(input,zone,from,until).get(0).issue()).contains("privado");
        var allowed=parser.parse(input,zone,from,until,true);
        assertThat(allowed).hasSize(1);
        assertThat(allowed.get(0).issue()).isNull();
        assertThat(allowed.get(0).allDay()).isTrue();
        assertThat(allowed.get(0).startsAt()).isEqualTo(LocalDate.of(2026,11,15).atStartOfDay());
        assertThat(allowed.get(0).endsAt()).isEqualTo(LocalDate.of(2026,11,16).atStartOfDay());
    }
}

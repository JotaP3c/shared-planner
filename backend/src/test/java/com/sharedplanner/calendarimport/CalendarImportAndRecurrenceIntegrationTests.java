package com.sharedplanner.calendarimport;

import com.sharedplanner.calendar.*;
import com.sharedplanner.event.*;
import com.sharedplanner.finance.FinanceService;
import com.sharedplanner.recurrence.*;
import com.sharedplanner.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties="spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class CalendarImportAndRecurrenceIntegrationTests {
    @Autowired CalendarImportService imports;
    @Autowired ImportedCalendarEventRepository importRepository;
    @Autowired EventSeriesService series;
    @Autowired EventSeriesRepository seriesRepository;
    @Autowired EventService events;
    @Autowired EventRepository eventRepository;
    @Autowired UserRepository users;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired FinanceService finance;
    @Autowired PlatformTransactionManager transactionManager;

    record Fixture(User owner,SharedCalendar calendar,Authentication auth) { }
    Fixture fixture() { return fixture(CalendarType.LEGACY); }
    Fixture fixture(CalendarType type) {
        User owner=users.save(new User("Fixture Owner","fixture-"+UUID.randomUUID()+"@example.test","unused",UserRole.FINANCE,null));
        SharedCalendar calendar=calendars.save(new SharedCalendar("Fixture calendar",owner,type));
        members.save(new CalendarMember(calendar,owner,CalendarMemberRole.ADMIN,owner));
        return new Fixture(owner,calendar,new UsernamePasswordAuthenticationToken(owner.getEmail(),"unused"));
    }
    CalendarImportRequest request(Fixture fixture,String ical,boolean confirmed) {
        return new CalendarImportRequest("BEGIN:VCALENDAR\nVERSION:2.0\n"+ical+"END:VCALENDAR\n","fixture-source",fixture.calendar().getId(),"America/Sao_Paulo",LocalDate.of(2026,10,1),LocalDate.of(2026,12,31),confirmed);
    }
    String source() { return "BEGIN:VEVENT\nUID:fixture-event-1\nSUMMARY:Synthetic imported\nDTSTART;TZID=America/Sao_Paulo:20261102T160000\nDTEND;TZID=America/Sao_Paulo:20261102T170000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4\nEND:VEVENT\n"; }
    String privateSource() { return "BEGIN:VEVENT\nUID:fixture-private-yearly\nCLASS:PRIVATE\nSUMMARY:Synthetic private birthday\nDTSTART;VALUE=DATE:20001115\nDTEND;VALUE=DATE:20001116\nRRULE:FREQ=YEARLY\nEND:VEVENT\n"; }
    CalendarImportRequest allowPrivate(CalendarImportRequest request) {
        return new CalendarImportRequest(request.ical(),request.sourceCalendarId(),request.targetCalendarId(),request.zoneId(),request.windowStart(),request.windowEnd(),request.mappingConfirmed(),true);
    }

    @Test void previewIsReadOnlyAndASecondConfirmedImportDoesNotDuplicateOrCreateRevenue() {
        Fixture fixture=fixture(); long before=eventRepository.count();
        var preview=imports.preview(request(fixture,source(),false),fixture.auth());
        assertThat(preview.rows()).hasSize(4).allMatch(row->row.state().equals("READY"));
        assertThat(eventRepository.count()).isEqualTo(before);
        var first=imports.commit(request(fixture,source(),true),fixture.auth());
        assertThat(first.imported()).isEqualTo(4);
        var second=imports.commit(request(fixture,source(),true),fixture.auth());
        assertThat(second.imported()).isZero(); assertThat(second.duplicates()).isEqualTo(4);
        assertThat(eventRepository.count()).isEqualTo(before+4);
        var values=events.list(fixture.calendar().getId(),LocalDate.of(2026,11,1).atStartOfDay(),LocalDate.of(2026,12,1).atStartOfDay(),fixture.auth());
        assertThat(values).allMatch(e->e.eventType()==EventType.PERSONAL&&e.amount()==null&&"GOOGLE_ICS".equals(e.externalSource()));
        assertThat(series.byEvent(values.get(0).id(),fixture.auth()).events()).hasSize(4);
        assertThat(finance.summarize(fixture.calendar().getId(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,30),fixture.auth()).appointmentCount()).isZero();
    }

    @Test void importRequiresExplicitMappingAndDoesNotPermitAnotherUsersCalendar() {
        Fixture target=fixture(),other=fixture();
        assertThatThrownBy(()->imports.commit(request(target,source(),false),target.auth())).isInstanceOf(ResponseStatusException.class).hasMessageContaining("mapeamento");
        assertThatThrownBy(()->imports.preview(request(target,source(),false),other.auth())).isInstanceOf(ResponseStatusException.class);
    }

    @Test void overlappingImportWindowsReuseUidOccurrenceAndSeriesIdentity() {
        Fixture fixture=fixture();var full=request(fixture,source(),true);
        var firstWindow=new CalendarImportRequest(full.ical(),full.sourceCalendarId(),full.targetCalendarId(),full.zoneId(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,4),true);
        assertThat(imports.commit(firstWindow,fixture.auth()).imported()).isEqualTo(2);
        var second=imports.commit(full,fixture.auth());
        assertThat(second.imported()).isEqualTo(2);
        assertThat(second.duplicates()).isEqualTo(2);
        var values=events.list(fixture.calendar().getId(),LocalDate.of(2026,11,1).atStartOfDay(),LocalDate.of(2026,12,1).atStartOfDay(),fixture.auth());
        assertThat(values).hasSize(4);
        assertThat(series.byEvent(values.get(0).id(),fixture.auth()).events()).hasSize(4);
    }

    @Test void reimportingFloatingSeriesWithAnotherDisplayZoneCannotDuplicateEvents() {
        Fixture fixture=fixture();
        String ical="BEGIN:VEVENT\nUID:fixture-floating-series\nSUMMARY:Synthetic floating series\nDTSTART:20261102T100000\nDTEND:20261102T110000\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\n";
        var first=request(fixture,ical,true);
        assertThat(imports.commit(first,fixture.auth()).imported()).isEqualTo(2);
        var otherZone=new CalendarImportRequest(first.ical(),first.sourceCalendarId(),first.targetCalendarId(),"UTC",first.windowStart(),first.windowEnd(),true);
        var second=imports.commit(otherZone,fixture.auth());
        assertThat(second.imported()).isZero();
        assertThat(second.duplicates()).isEqualTo(2);
    }

    @Test void privateEventsRequireSeparateOptInAndAnExclusiveOwnerDestination() {
        Fixture fixture=fixture(CalendarType.PERSONAL);long before=eventRepository.count();
        var original=request(fixture,privateSource(),true);
        assertThat(original.privateEventsAuthorized()).isFalse();
        assertThat(imports.preview(original,fixture.auth()).blocked()).isEqualTo(1);
        assertThat(imports.commit(original,fixture.auth()).imported()).isZero();
        var allowed=allowPrivate(original);
        assertThat(imports.preview(allowed,fixture.auth()).rows()).hasSize(1).allMatch(row->row.state().equals("READY"));
        assertThat(eventRepository.count()).isEqualTo(before);
        assertThat(imports.commit(allowed,fixture.auth()).imported()).isEqualTo(1);
        assertThat(imports.commit(allowed,fixture.auth()).duplicates()).isEqualTo(1);
        var importedEvents=events.list(fixture.calendar().getId(),LocalDate.of(2026,11,1).atStartOfDay(),LocalDate.of(2026,12,1).atStartOfDay(),fixture.auth());
        assertThat(importedEvents).hasSize(1);
        assertThat(importedEvents.get(0).startsAt()).isEqualTo(LocalDate.of(2026,11,15).atStartOfDay());
        assertThat(importedEvents.get(0).allDay()).isTrue();
    }

    @Test void systemAdminCanPerformAnAuthorizedPrivateImportWithoutAddingAnotherMember() {
        Fixture target=fixture(CalendarType.IMPORTED);
        User operator=users.save(new User("Fixture Operator","operator-"+UUID.randomUUID()+"@example.test","unused",UserRole.ADMIN,null));
        Authentication auth=new UsernamePasswordAuthenticationToken(operator.getEmail(),"unused");
        var allowed=allowPrivate(request(target,privateSource(),true));
        assertThat(imports.preview(allowed,auth).rows()).hasSize(1).allMatch(row->row.state().equals("READY"));
        assertThat(imports.commit(allowed,auth).imported()).isEqualTo(1);
        assertThat(members.findByCalendarIdOrderByCreatedAtAsc(target.calendar().getId())).hasSize(1).allMatch(member->member.getUser().getId().equals(target.owner().getId()));
    }

    @Test void privateOptInCannotImportIntoSharedOrLegacyDestinations() {
        for (CalendarType type:List.of(CalendarType.SHARED,CalendarType.LEGACY)) {
            Fixture target=fixture(type);long before=eventRepository.count();
            var allowed=allowPrivate(request(target,privateSource(),true));
            assertThatThrownBy(()->imports.preview(allowed,target.auth())).isInstanceOfSatisfying(ResponseStatusException.class,error->assertThat(error.getStatusCode().value()).isEqualTo(403));
            assertThatThrownBy(()->imports.commit(allowed,target.auth())).isInstanceOfSatisfying(ResponseStatusException.class,error->assertThat(error.getStatusCode().value()).isEqualTo(403));
            assertThat(eventRepository.count()).isEqualTo(before);
        }
    }

    @Test void privateOptInRejectsAdditionalMembersAndEditorsBeforeWriting() {
        Fixture target=fixture(CalendarType.PERSONAL),other=fixture();
        members.save(new CalendarMember(target.calendar(),other.owner(),CalendarMemberRole.EDITOR,target.owner()));
        var allowed=allowPrivate(request(target,privateSource(),true));long before=eventRepository.count();
        assertThatThrownBy(()->imports.preview(allowed,target.auth())).isInstanceOfSatisfying(ResponseStatusException.class,error->assertThat(error.getStatusCode().value()).isEqualTo(403));
        assertThatThrownBy(()->imports.commit(allowed,target.auth())).isInstanceOfSatisfying(ResponseStatusException.class,error->assertThat(error.getStatusCode().value()).isEqualTo(403));
        assertThatThrownBy(()->imports.commit(allowed,other.auth())).isInstanceOfSatisfying(ResponseStatusException.class,error->assertThat(error.getStatusCode().value()).isEqualTo(403));
        assertThat(eventRepository.count()).isEqualTo(before);
    }

    @Test void cancelledAndAllDaySourceRecordsPreserveTheirSemantics() {
        Fixture fixture=fixture();
        String ical="BEGIN:VEVENT\nUID:fixture-day\nSUMMARY:Synthetic all day\nDTSTART;VALUE=DATE:20261220\nDTEND;VALUE=DATE:20261221\nEND:VEVENT\n"
                +"BEGIN:VEVENT\nUID:fixture-cancelled\nSUMMARY:Synthetic cancelled\nDTSTART:20261222T100000\nDTEND:20261222T110000\nSTATUS:CANCELLED\nEND:VEVENT\n";
        assertThat(imports.commit(request(fixture,ical,true),fixture.auth()).imported()).isEqualTo(2);
        var values=events.list(fixture.calendar().getId(),LocalDate.of(2026,12,1).atStartOfDay(),LocalDate.of(2027,1,1).atStartOfDay(),fixture.auth());
        assertThat(values).anyMatch(e->e.title().equals("Synthetic all day")&&Boolean.TRUE.equals(e.allDay()));
        assertThat(values).anyMatch(e->e.title().equals("Synthetic cancelled")&&e.status()==EventStatus.CANCELLED);
    }

    @Test void reportsAnOverlapWithoutInventingABookingProhibition() {
        Fixture fixture=fixture();var start=LocalDateTime.of(2026,10,5,16,0);
        var template=new CreateEventRequest(fixture.calendar().getId(),EventType.PERSONAL,"Synthetic overlapping",null,"Fixture Owner",null,null,null,start,start.plusHours(1),null);
        events.create(template,fixture.auth());
        var created=series.create(new EventSeriesService.CreateSeriesRequest(template,new RecurrenceRule(RecurrenceRule.Frequency.WEEKLY,1,null,null,2,"America/Sao_Paulo")),fixture.auth());
        assertThat(created.events()).hasSize(2);
        assertThat(created.conflictCount()).isEqualTo(1);
    }

    @Test void recurringSharedEventsRequireASeparateDecisionForEachOccurrence() {
        Fixture owner=fixture(),invitee=fixture();
        SharedCalendar shared=calendars.save(new SharedCalendar("Synthetic shared",owner.owner(),CalendarType.SHARED));
        members.save(new CalendarMember(shared,owner.owner(),CalendarMemberRole.ADMIN,owner.owner()));
        members.save(new CalendarMember(shared,invitee.owner(),CalendarMemberRole.VIEWER,owner.owner()));
        var start=LocalDateTime.of(2026,12,1,14,0);
        var template=new CreateEventRequest(shared.getId(),EventType.SHARED,"Synthetic group",null,null,null,null,null,start,start.plusHours(1),invitee.owner().getEmail());
        var created=series.create(new EventSeriesService.CreateSeriesRequest(template,new RecurrenceRule(RecurrenceRule.Frequency.DAILY,1,null,null,2,"America/Sao_Paulo")),owner.auth());
        assertThat(created.events()).allMatch(e->e.status()==EventStatus.PENDING_APPROVAL);
        events.approve(created.events().get(0).id(),invitee.auth());
        var refreshed=series.byEvent(created.events().get(0).id(),owner.auth());
        assertThat(refreshed.events().get(0).status()).isEqualTo(EventStatus.APPROVED);
        assertThat(refreshed.events().get(1).status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(finance.summarize(shared.getId(),LocalDate.of(2026,12,1),LocalDate.of(2026,12,31),owner.auth()).appointmentCount()).isZero();
        assertThat(seriesRepository.findById(created.id()).orElseThrow().getRecurrenceRule()).contains("\"count\":2","\"frequency\":\"DAILY\"");
    }

    @Test void previewBlocksASharedDestinationWithoutAnotherActiveMember() {
        Fixture owner=fixture();
        SharedCalendar shared=calendars.save(new SharedCalendar("Synthetic empty shared",owner.owner(),CalendarType.SHARED));
        members.save(new CalendarMember(shared,owner.owner(),CalendarMemberRole.ADMIN,owner.owner()));
        var original=request(owner,source(),false);
        var request=new CalendarImportRequest(original.ical(),original.sourceCalendarId(),shared.getId(),original.zoneId(),original.windowStart(),original.windowEnd(),false);
        var preview=imports.preview(request,owner.auth());
        assertThat(preview.rows()).hasSize(4).allMatch(row->row.state().equals("BLOCKED")&&row.reason().contains("outro membro ativo"));
    }

    @Test void futureEditsAndIndividualCancellationPreserveEachPaidSnapshotAndIdentity() {
        Fixture fixture=fixture(); var start=LocalDateTime.of(2026,10,5,10,0);
        var template=new CreateEventRequest(fixture.calendar().getId(),EventType.CLIENT,"Synthetic client","Fixture client",null,null,"Fixture service",new BigDecimal("100.00"),start,start.plusHours(1),null);
        var created=series.create(new EventSeriesService.CreateSeriesRequest(template,new RecurrenceRule(RecurrenceRule.Frequency.WEEKLY,1,null,null,3,"America/Sao_Paulo")),fixture.auth());
        var first=created.events().get(0); var second=created.events().get(1);
        events.updatePayment(first.id(),new UpdatePaymentRequest(PaymentStatus.PAID,PaymentMethod.PIX,new BigDecimal("100.00"),null),fixture.auth());
        var edited=new UpdateEventRequest(EventType.CLIENT,"Synthetic revised","Fixture client",null,null,"Fixture service",new BigDecimal("100.00"),second.startsAt().plusHours(2),second.endsAt().plusHours(2),null);
        var updated=series.update(created.id(),EventSeriesService.Scope.FUTURE,second.id(),edited,fixture.auth());
        assertThat(updated.events()).hasSize(3);
        assertThat(updated.events().get(0).receivedAmount()).isEqualByComparingTo("100.00");
        assertThat(updated.events().get(0).startsAt()).isEqualTo(start);
        assertThat(updated.events().get(1).startsAt()).isEqualTo(second.startsAt().plusHours(2));
        assertThat(updated.events().get(1).receivedAmount()).isEqualByComparingTo("0.00");
        events.delete(second.id(),fixture.auth());
        assertThat(series.byEvent(second.id(),fixture.auth()).events()).hasSize(3).anyMatch(e->e.id().equals(second.id())&&e.status()==EventStatus.CANCELLED);
        assertThat(finance.summarize(fixture.calendar().getId(),LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),fixture.auth()).appointmentCount()).isEqualTo(2);
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    @DirtiesContext(methodMode=DirtiesContext.MethodMode.AFTER_METHOD)
    void aFailedSeriesUpdateRollsBackAllEarlierOccurrences() {
        Fixture fixture=new TransactionTemplate(transactionManager).execute(status->fixture());
        var start=LocalDateTime.of(2026,11,2,9,0);
        var template=new CreateEventRequest(fixture.calendar().getId(),EventType.CLIENT,"Synthetic original","Fixture client",null,null,"Service",new BigDecimal("50.00"),start,start.plusHours(1),null);
        var created=series.create(new EventSeriesService.CreateSeriesRequest(template,new RecurrenceRule(RecurrenceRule.Frequency.DAILY,1,null,null,2,"America/Sao_Paulo")),fixture.auth());
        events.updatePayment(created.events().get(1).id(),new UpdatePaymentRequest(PaymentStatus.PAID,PaymentMethod.PIX,new BigDecimal("50.00"),null),fixture.auth());
        var edited=new UpdateEventRequest(EventType.CLIENT,"Changed","Fixture client",null,null,"Service",new BigDecimal("20.00"),start,start.plusHours(1),null);
        assertThatThrownBy(()->series.update(created.id(),EventSeriesService.Scope.ALL,null,edited,fixture.auth())).isInstanceOf(ResponseStatusException.class);
        var restored=series.byEvent(created.events().get(0).id(),fixture.auth());
        assertThat(restored.events()).allMatch(e->e.title().equals("Synthetic original"));
        assertThat(restored.events()).allSatisfy(e->assertThat(e.amount()).isEqualByComparingTo("50.00"));
        assertThat(restored.events().get(1).receivedAmount()).isEqualByComparingTo("50.00");
    }
}

package com.sharedplanner.calendarimport;

import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.CalendarType;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.*;
import com.sharedplanner.recurrence.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

@Service
public class CalendarImportService {
    private final IcalendarParser parser;
    private final ImportedCalendarEventRepository imported;
    private final EventService events;
    private final EventSeriesService series;
    private final AuthorizationService authorization;
    private final EntityManager entityManager;
    public CalendarImportService(IcalendarParser parser,ImportedCalendarEventRepository imported,EventService events,
                                  EventSeriesService series,AuthorizationService authorization,EntityManager entityManager) {
        this.parser=parser;this.imported=imported;this.events=events;this.series=series;this.authorization=authorization;this.entityManager=entityManager;
    }
    public record ImportRow(String uid,String recurrenceId,String title,LocalDateTime startsAt,LocalDateTime endsAt,String state,String reason) { }
    public record ImportResponse(String source,String sourceCalendarId,UUID targetCalendarId,List<ImportRow> rows,int imported,int duplicates,int blocked) { }

    @Transactional(readOnly=true)
    public ImportResponse preview(CalendarImportRequest request,Authentication authentication) { return process(request,authentication,false); }
    @Transactional
    public ImportResponse commit(CalendarImportRequest request,Authentication authentication) {
        if(!request.mappingConfirmed())throw bad("Confirme o mapeamento e sua autorização sobre a origem antes de importar.");
        return process(request,authentication,true);
    }
    private ImportResponse process(CalendarImportRequest request,Authentication authentication,boolean apply) {
        authorization.ensureCanCreateEvent(request.targetCalendarId(),authentication);
        SharedCalendar target=apply?entityManager.find(SharedCalendar.class,request.targetCalendarId(),LockModeType.PESSIMISTIC_WRITE):entityManager.find(SharedCalendar.class,request.targetCalendarId());
        if(target==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Calendário não encontrado.");
        if(request.privateEventsAuthorized()) ensurePrivateDestination(target,authentication);
        boolean needsInvitee=target.getCalendarType()==CalendarType.SHARED && entityManager.createQuery(
                "select count(m) from CalendarMember m where m.calendar.id=:calendar and m.user.active=true and lower(m.user.email)<>:actor",Long.class)
                .setParameter("calendar",target.getId()).setParameter("actor",authentication.getName().toLowerCase(Locale.ROOT)).getSingleResult()==0;
        List<IcalendarParser.Item> values=parser.parse(request.ical(),RecurrenceEngine.zone(request.zoneId()),request.windowStart(),request.windowEnd(),request.privateEventsAuthorized());
        List<ImportRow> rows=new ArrayList<>();Set<String> encountered=new HashSet<>();int created=0,duplicates=0,blocked=0;
        for(IcalendarParser.Item item:values) {
            String key=identity(request.sourceCalendarId(),item.uid(),item.recurrenceId(),request.targetCalendarId());
            String state,reason=item.issue();
            if(reason==null&&needsInvitee) reason="Adicione outro membro ativo ao calendário compartilhado antes da importação; os eventos exigem aprovação.";
            if(reason!=null) { state="BLOCKED";blocked++; }
            else if(!encountered.add(key)||imported.existsByIdentityKey(key)) { state="DUPLICATE";reason="Ocorrência já importada; dados existentes preservados.";duplicates++; }
            else {
                state="READY";
                if(apply) {
                    // No guessed client price, service or invitee: importing as PERSONAL never creates revenue.
                    CreateEventRequest eventRequest=new CreateEventRequest(target.getId(),EventType.PERSONAL,item.title(),null,
                            target.getOwner().getFullName(),item.description(),null,null,item.startsAt(),item.endsAt(),null).withAllDay(item.allDay());
                    EventResponse event=events.create(eventRequest,authentication);
                    entityManager.find(Event.class,event.id()).setExternalSource("GOOGLE_ICS");
                    if(item.cancelled())events.delete(event.id(),authentication);
                    imported.save(new ImportedCalendarEvent(key,request.sourceCalendarId(),item.uid(),item.recurrenceId(),target.getId(),event.id()));
                    if(!item.recurrenceId().isBlank()) {
                        String seriesKey=identity(request.sourceCalendarId(),item.uid(),"SERIES",target.getId());
                        EventSeries importedSeries=series.importSeries(target.getId(),item.frequency()==null?"CUSTOM":item.frequency(),request.zoneId(),seriesKey,item.rule());
                        LocalDateTime original=item.allDay()?LocalDate.parse(item.recurrenceId()).atStartOfDay()
                                :item.recurrenceId().startsWith("FLOAT:")?LocalDateTime.parse(item.recurrenceId().substring(6))
                                :Instant.parse(item.recurrenceId()).atZone(ZoneId.of(request.zoneId())).toLocalDateTime();
                        series.linkImported(importedSeries,event.id(),original);
                    }
                    state="IMPORTED";created++;
                }
            }
            rows.add(new ImportRow(item.uid(),item.recurrenceId(),item.title(),item.startsAt(),item.endsAt(),state,reason));
        }
        return new ImportResponse("GOOGLE_ICS",request.sourceCalendarId(),request.targetCalendarId(),List.copyOf(rows),created,duplicates,blocked);
    }
    private void ensurePrivateDestination(SharedCalendar target,Authentication authentication) {
        authorization.ensureCanManageCalendar(target.getId(),authentication);
        if(target.getCalendarType()!=CalendarType.PERSONAL && target.getCalendarType()!=CalendarType.IMPORTED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Eventos privados exigem um calendário pessoal ou importado exclusivo do proprietário.");
        }
        long total=entityManager.createQuery("select count(m) from CalendarMember m where m.calendar.id=:calendar",Long.class)
                .setParameter("calendar",target.getId()).getSingleResult();
        long owner=entityManager.createQuery("select count(m) from CalendarMember m where m.calendar.id=:calendar and m.user.id=:owner",Long.class)
                .setParameter("calendar",target.getId()).setParameter("owner",target.getOwner().getId()).getSingleResult();
        if(total!=1 || owner!=1) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Remova o compartilhamento do destino: eventos privados só podem ser importados com o proprietário como único membro.");
        }
    }
    private static String identity(String sourceCalendar,String uid,String recurrence,UUID target) {
        try {
            // Length prefixes avoid ambiguous identity tuples; hash prevents oversized unique indexes.
            String value="GOOGLE_ICS|"+sourceCalendar.length()+":"+sourceCalendar+"|"+uid.length()+":"+uid+"|"+recurrence.length()+":"+recurrence+"|"+target;
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch(java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 indisponível."); }
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}

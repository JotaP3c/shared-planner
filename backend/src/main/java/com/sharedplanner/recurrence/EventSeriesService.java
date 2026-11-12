package com.sharedplanner.recurrence;

import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class EventSeriesService {
    private final EventSeriesRepository seriesRepository;
    private final SeriesOccurrenceRepository occurrenceRepository;
    private final EventService events;
    private final AuthorizationService authorization;
    private final RecurrenceEngine engine;
    public EventSeriesService(EventSeriesRepository seriesRepository, SeriesOccurrenceRepository occurrenceRepository,
                              EventService events, AuthorizationService authorization, RecurrenceEngine engine) {
        this.seriesRepository=seriesRepository; this.occurrenceRepository=occurrenceRepository;
        this.events=events; this.authorization=authorization; this.engine=engine;
    }

    public record CreateSeriesRequest(@NotNull @Valid CreateEventRequest event, @NotNull @Valid RecurrenceRule recurrence) { }
    public record SeriesResponse(UUID id, String frequency, String zoneId, List<EventResponse> events, Integer conflictCount) { }
    public enum Scope { ALL, FUTURE }

    @Transactional
    public SeriesResponse create(CreateSeriesRequest request, Authentication authentication) {
        CreateEventRequest template=request.event();
        authorization.ensureCanCreateEvent(template.calendarId(), authentication);
        if (!template.endsAt().isAfter(template.startsAt())) throw bad("O término deve ser posterior ao início.");
        Duration duration=Duration.between(template.startsAt(), template.endsAt());
        List<LocalDateTime> starts=engine.expand(template.startsAt(), request.recurrence());
        List<EventResponse> existing=events.list(template.calendarId(),starts.get(0),starts.get(starts.size()-1).plus(duration),authentication);
        List<EventResponse> inspected=new ArrayList<>(existing);
        int conflictCount=0;
        EventSeries series=seriesRepository.save(new EventSeries(template.calendarId(),request.recurrence().frequency().name(),request.recurrence().zoneId(),null,ruleSnapshot(request.recurrence())));
        List<EventResponse> created=new ArrayList<>();
        for (LocalDateTime start:starts) {
            RecurrenceEngine.requireValidLocalTime(start.plus(duration),RecurrenceEngine.zone(series.getZoneId()));
            if (inspected.stream().anyMatch(value->value.status()!=EventStatus.CANCELLED && value.status()!=EventStatus.REJECTED
                    && value.startsAt().isBefore(start.plus(duration)) && value.endsAt().isAfter(start))) conflictCount++;
            EventResponse event=events.create(template.withPeriod(start,start.plus(duration)),authentication);
            occurrenceRepository.save(new SeriesOccurrence(series,event.id(),start));
            created.add(event);
            inspected.add(event);
        }
        return new SeriesResponse(series.getId(),series.getFrequency(),series.getZoneId(),List.copyOf(created),conflictCount);
    }

    @Transactional(readOnly=true)
    public SeriesResponse byEvent(UUID eventId, Authentication authentication) {
        events.findById(eventId,authentication);
        SeriesOccurrence occurrence=occurrenceRepository.findByEventId(eventId).orElseThrow(()->notFound("O evento não pertence a uma série."));
        return load(occurrence.getSeries(),authentication);
    }

    @Transactional
    public SeriesResponse update(UUID id, Scope scope, UUID fromEventId, UpdateEventRequest template, Authentication authentication) {
        EventSeries series=series(id,authentication);
        List<SeriesOccurrence> occurrences=selected(id,scope,fromEventId);
        SeriesOccurrence anchor=fromEventId==null?occurrences.get(0):occurrenceRepository.findByEventId(fromEventId).orElseThrow(()->bad("Ocorrência inicial inválida."));
        EventResponse original=events.findById(anchor.getEventId(),authentication);
        Duration shift=Duration.between(original.startsAt(),template.startsAt());
        Duration duration=Duration.between(template.startsAt(),template.endsAt());
        if (duration.isZero()||duration.isNegative()) throw bad("O término deve ser posterior ao início.");
        for (SeriesOccurrence occurrence:occurrences) {
            EventResponse current=events.findById(occurrence.getEventId(),authentication);
            if (current.status()==EventStatus.CANCELLED) continue;
            LocalDateTime start=current.startsAt().plus(shift),end=start.plus(duration);
            RecurrenceEngine.requireValidLocalTime(start,RecurrenceEngine.zone(series.getZoneId()));
            RecurrenceEngine.requireValidLocalTime(end,RecurrenceEngine.zone(series.getZoneId()));
            events.update(current.id(),template.withPeriod(start,end),authentication);
        }
        return load(series,authentication);
    }

    @Transactional
    public void cancel(UUID id, Scope scope, UUID fromEventId, Authentication authentication) {
        series(id,authentication);
        for (SeriesOccurrence occurrence:selected(id,scope,fromEventId)) {
            if (events.findById(occurrence.getEventId(),authentication).status()!=EventStatus.CANCELLED) events.delete(occurrence.getEventId(),authentication);
        }
    }

    /** Internal import registration; caller already holds the target calendar lock and authorization. */
    @Transactional
    public EventSeries importSeries(UUID calendarId,String frequency,String zoneId,String key,String rule) {
        return seriesRepository.findBySourceKey(key).orElseGet(()->seriesRepository.save(new EventSeries(calendarId,frequency,zoneId,key,rule)));
    }
    @Transactional
    public void linkImported(EventSeries series,UUID eventId,LocalDateTime originalStart) {
        occurrenceRepository.save(new SeriesOccurrence(series,eventId,originalStart));
    }
    private List<SeriesOccurrence> selected(UUID id,Scope scope,UUID fromEventId) {
        List<SeriesOccurrence> all=occurrenceRepository.findBySeriesIdOrderByOriginalStartsAtAsc(id);
        if (all.isEmpty()) throw notFound("Série sem ocorrências.");
        if (fromEventId!=null&&all.stream().noneMatch(o->o.getEventId().equals(fromEventId))) throw bad("A ocorrência não pertence à série.");
        if (scope!=Scope.FUTURE) return all;
        if (fromEventId==null) throw bad("Informe a ocorrência inicial para alterar os eventos seguintes.");
        LocalDateTime from=all.stream().filter(o->o.getEventId().equals(fromEventId)).findFirst().orElseThrow().getOriginalStartsAt();
        return all.stream().filter(o->!o.getOriginalStartsAt().isBefore(from)).toList();
    }
    private EventSeries series(UUID id,Authentication authentication) {
        EventSeries series=seriesRepository.findById(id).orElseThrow(()->notFound("Série não encontrada."));
        authorization.ensureCalendarVisible(series.getCalendarId(),authentication); return series;
    }
    private SeriesResponse load(EventSeries series,Authentication authentication) {
        return response(series,occurrenceRepository.findBySeriesIdOrderByOriginalStartsAtAsc(series.getId()).stream().map(o->events.findById(o.getEventId(),authentication)).toList());
    }
    private SeriesResponse response(EventSeries series,List<EventResponse> values) { return new SeriesResponse(series.getId(),series.getFrequency(),series.getZoneId(),values,null); }
    private static String ruleSnapshot(RecurrenceRule rule) {
        String days=rule.weekDays()==null?"":rule.weekDays().stream().sorted().map(day->"\""+day.name()+"\"").collect(java.util.stream.Collectors.joining(","));
        // Values are validated enums, integers, ISO dates and ZoneId identifiers, never user text.
        return "{\"frequency\":\""+rule.frequency()+"\",\"interval\":"+rule.interval()+",\"weekDays\":["+days+"]"
                +",\"until\":"+(rule.until()==null?"null":"\""+rule.until()+"\"")+",\"count\":"+rule.count()+",\"zoneId\":\""+rule.zoneId()+"\"}";
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    private static ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND,message); }
}

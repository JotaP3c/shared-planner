package com.sharedplanner.calendarimport;

import com.sharedplanner.recurrence.RecurrenceEngine;
import com.sharedplanner.recurrence.RecurrenceRule;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Strict, bounded RFC 5545 subset. Unsupported rules are reported, never guessed. */
@Component
public class IcalendarParser {
    private static final DateTimeFormatter DATE_TIME=DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss").withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter DATE_MINUTE=DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmm").withResolverStyle(ResolverStyle.STRICT);
    public record Item(String uid,String recurrenceId,String title,String description,LocalDateTime startsAt,
                       LocalDateTime endsAt,boolean allDay,boolean cancelled,String rule,String frequency,String issue) { }
    private record Property(String name,Map<String,String> parameters,String value) { }
    private record ParsedTime(LocalDateTime local,ZoneId zone,boolean allDay,boolean floating) {
        ParsedTime(LocalDateTime local,ZoneId zone,boolean allDay) { this(local,zone,allDay,false); }
        String identity() { return allDay?local.toLocalDate().toString():floating?"FLOAT:"+local:local.atZone(zone).toInstant().toString(); }
        LocalDateTime in(ZoneId target) { return allDay?local:local.atZone(zone).withZoneSameInstant(target).toLocalDateTime(); }
    }

    public List<Item> parse(String input,ZoneId target,LocalDate from,LocalDate until) {
        return parse(input,target,from,until,false);
    }

    /** allowPrivate is supplied only after the import service validates an explicitly authorized private destination. */
    public List<Item> parse(String input,ZoneId target,LocalDate from,LocalDate until,boolean allowPrivate) {
        if (input==null||input.length()>1_000_000||!input.contains("BEGIN:VCALENDAR")) throw bad("Envie um arquivo iCalendar válido de até 1 MB.");
        if (from==null||until==null||until.isBefore(from)||ChronoUnit.DAYS.between(from,until)>366) throw bad("Escolha uma janela de importação de até 367 dias.");
        List<Map<String,List<Property>>> components=components(input);
        if (components.size()>1000) throw bad("O arquivo permite no máximo 1.000 componentes por importação.");
        List<Item> result=new ArrayList<>();
        Map<String,List<Map<String,List<Property>>>> grouped=new LinkedHashMap<>();
        for (Map<String,List<Property>> component:components) grouped.computeIfAbsent(value(component,"UID"),ignored->new ArrayList<>()).add(component);
        for (var entry:grouped.entrySet()) {
            String uid=entry.getKey();
            List<Map<String,List<Property>>> group=entry.getValue();
            try {
                if (uid.isBlank()||uid.length()>1024) throw bad("UID ausente ou inválido; não é seguro deduplicar o evento.");
                List<Map<String,List<Property>>> masters=group.stream().filter(v->!v.containsKey("RECURRENCE-ID")).toList();
                if (masters.size()!=1) throw bad("UID sem evento-base único. Revise componentes duplicados ou exporte a série completa.");
                Map<String,List<Property>> master=masters.get(0);
                required(master,"UID");
                if (!allowPrivate && ("PRIVATE".equalsIgnoreCase(value(master,"CLASS"))||"CONFIDENTIAL".equalsIgnoreCase(value(master,"CLASS")))) throw bad("Evento privado: revise a privacidade e o compartilhamento antes de importar.");
                ParsedTime start=time(required(master,"DTSTART"),target);
                ParsedTime end=end(master,start,target);
                Duration duration=Duration.between(start.local(),end.local());
                if (duration.isZero()||duration.isNegative()) throw bad("O evento precisa de término posterior ao início.");
                String title=text(value(master,"SUMMARY"));
                if (title.isBlank()||title.length()>180) throw bad("Título ausente ou maior que 180 caracteres.");
                String rawRule=value(master,"RRULE");
                if (master.containsKey("RRULE")) required(master,"RRULE");
                List<ParsedTime> starts=rawRule.isBlank()?new ArrayList<>(List.of(start)):expand(start,rawRule,from,until,target);
                TreeMap<String,ParsedTime> distinct=new TreeMap<>();
                for (ParsedTime candidate:starts) distinct.put(candidate.identity(),candidate);
                for (Property property:master.getOrDefault("RDATE",List.of())) {
                    for (String part:property.value().split(",")) {
                        ParsedTime candidate=time(new Property(property.name(),property.parameters(),part),start.zone());
                        distinct.put(candidate.identity(),candidate);
                    }
                }
                Set<String> excluded=new HashSet<>();
                for (Property property:master.getOrDefault("EXDATE",List.of())) {
                    for (String part:property.value().split(",")) excluded.add(time(new Property(property.name(),property.parameters(),part),start.zone()).identity());
                }
                Map<String,Map<String,List<Property>>> overrides=new HashMap<>();
                for (Map<String,List<Property>> component:group) {
                    if (!component.containsKey("RECURRENCE-ID")) continue;
                    Property recurrence=required(component,"RECURRENCE-ID");
                    if (recurrence.parameters().containsKey("RANGE")) throw bad("Exceções RANGE=THISANDFUTURE precisam de revisão manual.");
                    String key=time(recurrence,start.zone()).identity();
                    if (overrides.put(key,component)!=null) throw bad("Exceções duplicadas para a mesma ocorrência.");
                    distinct.putIfAbsent(key,time(recurrence,start.zone()));
                }
                boolean recurring=!rawRule.isBlank()||master.containsKey("RDATE");
                for (var occurrence:distinct.entrySet()) {
                    String key=occurrence.getKey();
                    Map<String,List<Property>> override=overrides.get(key);
                    if (excluded.contains(key)&&override==null) continue;
                    if (!allowPrivate && override!=null && ("PRIVATE".equalsIgnoreCase(value(override,"CLASS"))||"CONFIDENTIAL".equalsIgnoreCase(value(override,"CLASS")))) throw bad("Exceção privada exige revisão de compartilhamento.");
                    ParsedTime currentStart=override!=null&&override.containsKey("DTSTART")?time(required(override,"DTSTART"),start.zone()):occurrence.getValue();
                    ParsedTime currentEnd=override!=null&&(override.containsKey("DTEND")||override.containsKey("DURATION"))?end(override,currentStart,start.zone()):new ParsedTime(currentStart.local().plus(duration),currentStart.zone(),currentStart.allDay());
                    LocalDateTime outputStart=currentStart.in(target),outputEnd=currentEnd.in(target);
                    if (outputStart.toLocalDate().isBefore(from)||outputStart.toLocalDate().isAfter(until)) continue;
                    if (!outputEnd.isAfter(outputStart)) throw bad("Exceção com intervalo inválido.");
                    String overrideTitle=override==null?"":text(value(override,"SUMMARY"));
                    String outputTitle=overrideTitle.isBlank()?title:overrideTitle;
                    if (outputTitle.length()>180) throw bad("Título de exceção maior que 180 caracteres.");
                    boolean cancelled="CANCELLED".equalsIgnoreCase(value(override!=null&&override.containsKey("STATUS")?override:master,"STATUS"));
                    String description=text(value(override!=null&&override.containsKey("DESCRIPTION")?override:master,"DESCRIPTION"));
                    result.add(new Item(uid,recurring?key:"",outputTitle,description,outputStart,outputEnd,currentStart.allDay(),cancelled,rawRule,ruleFrequency(rawRule),null));
                    if (result.size()>1000) throw bad("A janela produz mais de 1.000 eventos; reduza o período.");
                }
            } catch (RuntimeException exception) {
                // Never expose parser exception contents: they may contain private source values.
                result.removeIf(item->item.uid().equals(uid));
                String reason=exception instanceof ResponseStatusException response?response.getReason():"Dados de data, fuso ou recorrência não suportados. Revise o arquivo.";
                result.add(new Item(uid,"",text(value(group.get(0),"SUMMARY")),null,null,null,false,false,null,null,reason));
            }
        }
        return List.copyOf(result);
    }

    private List<ParsedTime> expand(ParsedTime first,String raw,LocalDate from,LocalDate until,ZoneId target) {
        Map<String,String> rule=new HashMap<>();
        for (String segment:raw.split(";")) {
            String[] pair=segment.split("=",2);
            if (pair.length!=2||rule.put(pair[0],pair[1])!=null) throw bad("Regra de recorrência inválida.");
        }
        if (!Set.of("FREQ","INTERVAL","COUNT","UNTIL","BYDAY","WKST","BYMONTHDAY","BYMONTH").containsAll(rule.keySet())) throw bad("A regra contém opções ainda não suportadas; nenhuma ocorrência foi importada.");
        RecurrenceRule.Frequency frequency;
        try { frequency=RecurrenceRule.Frequency.valueOf(rule.getOrDefault("FREQ","")); }
        catch(Exception ignored) { throw bad("Frequência ICS não suportada; use DAILY, WEEKLY, MONTHLY ou YEARLY."); }
        if (!Set.of(RecurrenceRule.Frequency.DAILY,RecurrenceRule.Frequency.WEEKLY,RecurrenceRule.Frequency.MONTHLY,RecurrenceRule.Frequency.YEARLY).contains(frequency)) throw bad("Frequência ICS não suportada.");
        int interval=Integer.parseInt(rule.getOrDefault("INTERVAL","1"));
        int count=rule.containsKey("COUNT")?Integer.parseInt(rule.get("COUNT")):Integer.MAX_VALUE;
        if (interval<1||interval>366||count<1) throw bad("Intervalo ou quantidade de recorrência inválidos.");
        if (rule.containsKey("UNTIL")&&rule.containsKey("COUNT")) throw bad("A regra não pode combinar COUNT e UNTIL.");
        if (rule.containsKey("BYDAY")&&frequency!=RecurrenceRule.Frequency.WEEKLY) throw bad("BYDAY é suportado somente em séries semanais.");
        if (rule.containsKey("BYMONTHDAY")&&frequency!=RecurrenceRule.Frequency.MONTHLY&&frequency!=RecurrenceRule.Frequency.YEARLY) throw bad("BYMONTHDAY exige frequência mensal ou anual.");
        if (rule.containsKey("BYMONTH")&&frequency!=RecurrenceRule.Frequency.YEARLY) throw bad("BYMONTH exige frequência anual neste importador.");
        Set<DayOfWeek> days=new HashSet<>();
        Map<String,DayOfWeek> names=Map.of("MO",DayOfWeek.MONDAY,"TU",DayOfWeek.TUESDAY,"WE",DayOfWeek.WEDNESDAY,"TH",DayOfWeek.THURSDAY,"FR",DayOfWeek.FRIDAY,"SA",DayOfWeek.SATURDAY,"SU",DayOfWeek.SUNDAY);
        DayOfWeek weekStart=names.get(rule.getOrDefault("WKST","MO"));
        if (weekStart==null) throw bad("WKST inválido: informe MO, TU, WE, TH, FR, SA ou SU.");
        for (String name:rule.getOrDefault("BYDAY",names.entrySet().stream().filter(e->e.getValue()==first.local().getDayOfWeek()).findFirst().orElseThrow().getKey()).split(",")) {
            DayOfWeek day=names.get(name); if (day==null) throw bad("BYDAY ordinal ou inválido exige revisão manual."); days.add(day);
        }
        int monthDay=rule.containsKey("BYMONTHDAY")?Integer.parseInt(rule.get("BYMONTHDAY")):first.local().getDayOfMonth();
        if (monthDay<1||monthDay>31) throw bad("BYMONTHDAY deve conter um dia entre 1 e 31.");
        int month=rule.containsKey("BYMONTH")?Integer.parseInt(rule.get("BYMONTH")):first.local().getMonthValue();
        if (month<1||month>12) throw bad("BYMONTH deve conter um mês entre 1 e 12.");
        LocalDateTime last=until.plusDays(2).atStartOfDay();
        if (rule.containsKey("UNTIL")) last=time(new Property("UNTIL",Map.of(),rule.get("UNTIL")),first.zone()).in(first.zone());
        LocalDate lastDate=last.toLocalDate().isBefore(until.plusDays(2))?last.toLocalDate():until.plusDays(2);
        if (first.local().toLocalDate().isBefore(until.minusYears(100))) throw bad("Série histórica maior que 100 anos exige divisão da exportação.");
        List<ParsedTime> result=new ArrayList<>(); int generated=0;
        for (LocalDate date=first.local().toLocalDate();!date.isAfter(lastDate);date=date.plusDays(1)) {
            boolean match=switch (frequency) {
                case MONTHLY -> date.getDayOfMonth()==monthDay&&ChronoUnit.MONTHS.between(YearMonth.from(first.local()),YearMonth.from(date))%interval==0;
                case YEARLY -> date.getMonthValue()==month&&date.getDayOfMonth()==monthDay&&(date.getYear()-first.local().getYear())%interval==0;
                case WEEKLY -> days.contains(date.getDayOfWeek())&&ChronoUnit.WEEKS.between(
                        first.local().toLocalDate().with(TemporalAdjusters.previousOrSame(weekStart)),date.with(TemporalAdjusters.previousOrSame(weekStart)))%interval==0;
                default -> RecurrenceEngine.matches(first.local().toLocalDate(),date,frequency,interval,days);
            };
            if (!match) continue;
            LocalDateTime local=date.atTime(first.local().toLocalTime());
            if (local.isAfter(last)) break;
            if (++generated>count) break;
            RecurrenceEngine.requireValidLocalTime(local,first.zone());
            ParsedTime candidate=new ParsedTime(local,first.zone(),first.allDay(),first.floating());
            LocalDate mapped=candidate.in(target).toLocalDate();
            if (!mapped.isBefore(from)&&!mapped.isAfter(until)) result.add(candidate);
            if (result.size()>366) throw bad("A série produz mais de 366 ocorrências na janela selecionada.");
        }
        return result;
    }

    private List<Map<String,List<Property>>> components(String source) {
        List<String> unfolded=new ArrayList<>();
        for (String line:source.replace("\r\n","\n").replace('\r','\n').split("\n")) {
            if ((line.startsWith(" ")||line.startsWith("\t"))&&!unfolded.isEmpty()) unfolded.set(unfolded.size()-1,unfolded.get(unfolded.size()-1)+line.substring(1));
            else unfolded.add(line);
        }
        List<Map<String,List<Property>>> events=new ArrayList<>(); Map<String,List<Property>> current=null; int nested=0;
        for (String line:unfolded) {
            if ("BEGIN:VEVENT".equals(line)) { if (current!=null) throw bad("Componentes VEVENT aninhados inválidos."); current=new LinkedHashMap<>(); nested=0; continue; }
            if ("END:VEVENT".equals(line)) { if (current==null||nested!=0) throw bad("Componente VEVENT inválido."); events.add(current);current=null;continue; }
            if (current==null) continue;
            if (line.startsWith("BEGIN:")) { nested++;continue; }
            if (line.startsWith("END:")) { nested--; if(nested<0)throw bad("Componente aninhado inválido.");continue; }
            if (nested>0||line.isBlank()) continue;
            int colon=separator(line,':'); if(colon<0)throw bad("Linha ICS sem separador.");
            String[] header=line.substring(0,colon).split(";"); String name=header[0].toUpperCase(Locale.ROOT);
            Map<String,String> parameters=new HashMap<>();
            for(int i=1;i<header.length;i++) { String[] pair=header[i].split("=",2); if(pair.length!=2)throw bad("Parâmetro ICS inválido.");parameters.put(pair[0].toUpperCase(Locale.ROOT),pair[1].replace("\"","")); }
            current.computeIfAbsent(name,ignored->new ArrayList<>()).add(new Property(name,parameters,line.substring(colon+1)));
        }
        if(current!=null||!source.contains("END:VCALENDAR"))throw bad("Arquivo ICS incompleto.");
        if(events.isEmpty())throw bad("O arquivo não contém eventos VEVENT.");
        return events;
    }
    private static int separator(String line,char separator) { boolean quoted=false;for(int i=0;i<line.length();i++){char c=line.charAt(i);if(c=='"')quoted=!quoted;if(c==separator&&!quoted)return i;}return -1; }
    private ParsedTime end(Map<String,List<Property>> component,ParsedTime start,ZoneId fallback) {
        if(component.containsKey("DTEND")&&component.containsKey("DURATION"))throw bad("DTEND e DURATION não podem coexistir.");
        if(component.containsKey("DTEND")) {
            ParsedTime end=time(required(component,"DTEND"),fallback);
            if(end.allDay()!=start.allDay())throw bad("DTSTART e DTEND precisam do mesmo tipo de data.");
            return new ParsedTime(end.in(start.zone()),start.zone(),end.allDay());
        }
        if(component.containsKey("DURATION")) {
            String value=value(component,"DURATION");
            Duration duration=value.matches("P\\d+W")?Duration.ofDays(Long.parseLong(value.substring(1,value.length()-1))*7):Duration.parse(value);
            return new ParsedTime(start.local().plus(duration),start.zone(),start.allDay());
        }
        if(start.allDay())return new ParsedTime(start.local().plusDays(1),start.zone(),true);
        throw bad("Hora final ou duração ausente; o término não será inventado.");
    }
    private ParsedTime time(Property property,ZoneId fallback) {
        String value=property.value();
        if(value.matches("\\d{8}")||"DATE".equals(property.parameters().get("VALUE")))return new ParsedTime(LocalDate.parse(value,DateTimeFormatter.BASIC_ISO_DATE).atStartOfDay(),fallback,true);
        ZoneId zone=property.parameters().containsKey("TZID")?RecurrenceEngine.zone(property.parameters().get("TZID")):fallback;
        boolean utc=value.endsWith("Z");String local=utc?value.substring(0,value.length()-1):value;
        LocalDateTime date=LocalDateTime.parse(local,local.length()==13?DATE_MINUTE:DATE_TIME);
        if(utc)zone=ZoneOffset.UTC;
        RecurrenceEngine.requireValidLocalTime(date,zone);
        return new ParsedTime(date,zone,false,!utc&&!property.parameters().containsKey("TZID"));
    }
    private static Property required(Map<String,List<Property>> component,String name) {
        List<Property> values=component.get(name);if(values==null||values.size()!=1)throw bad("Campo obrigatório ausente ou duplicado: "+name+".");return values.get(0);
    }
    private static String value(Map<String,List<Property>> component,String name) { List<Property> values=component.get(name);return values==null?"":values.get(0).value(); }
    private static String ruleFrequency(String rule) { if(rule==null||rule.isBlank())return null;for(String segment:rule.split(";"))if(segment.startsWith("FREQ="))return segment.substring(5);return null; }
    private static String text(String value) { return value.replace("\\n","\n").replace("\\N","\n").replace("\\,",",").replace("\\;",";").replace("\\\\","\\"); }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}

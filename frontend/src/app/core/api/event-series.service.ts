import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CreateEventRequest, EventSeriesResponse, RecurrenceRequest, UpdateEventRequest } from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class EventSeriesService {
  private readonly http = inject(HttpClient);
  create(event: CreateEventRequest, recurrence: RecurrenceRequest) {
    return this.http.post<EventSeriesResponse>('/api/event-series', { event, recurrence });
  }
  byEvent(eventId: string) {
    return this.http.get<EventSeriesResponse>(`/api/event-series/by-event/${eventId}`);
  }
  update(id: string, fromEventId: string, scope: 'ALL' | 'FUTURE', event: UpdateEventRequest) {
    return this.http.put<EventSeriesResponse>(`/api/event-series/${id}`, event, {
      params: new HttpParams().set('scope', scope).set('fromEventId', fromEventId),
    });
  }
  cancel(id: string, fromEventId: string, scope: 'ALL' | 'FUTURE') {
    return this.http.delete<void>(`/api/event-series/${id}`, {
      params: new HttpParams().set('scope', scope).set('fromEventId', fromEventId),
    });
  }
}

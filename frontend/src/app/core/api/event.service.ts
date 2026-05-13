import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ClientRevenueSummaryResponse,
  CreateEventRequest,
  EventResponse,
  RevenuePeriod,
  UpdateEventRequest,
  UpdatePaymentRequest,
} from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/events';

  create(request: CreateEventRequest) {
    return this.http.post<EventResponse>(this.apiUrl, request);
  }

  list(calendarId: string, start: string, end: string) {
    const params = new HttpParams()
      .set('calendarId', calendarId)
      .set('start', start)
      .set('end', end);

    return this.http.get<EventResponse[]>(this.apiUrl, { params });
  }

  summarizeClientRevenue(calendarId: string, period: RevenuePeriod, date?: string) {
    let params = new HttpParams()
      .set('calendarId', calendarId)
      .set('period', period);

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<ClientRevenueSummaryResponse>(
      `${this.apiUrl}/client-revenue`,
      { params },
    );
  }

  findById(eventId: string) {
    return this.http.get<EventResponse>(`${this.apiUrl}/${eventId}`);
  }

  update(eventId: string, request: UpdateEventRequest) {
    return this.http.put<EventResponse>(`${this.apiUrl}/${eventId}`, request);
  }

  updatePayment(eventId: string, request: UpdatePaymentRequest) {
    return this.http.put<EventResponse>(`${this.apiUrl}/${eventId}/payment`, request);
  }

  delete(eventId: string) {
    return this.http.delete<void>(`${this.apiUrl}/${eventId}`);
  }

  approve(eventId: string) {
    return this.http.post<EventResponse>(`${this.apiUrl}/${eventId}/approve`, {});
  }

  reject(eventId: string) {
    return this.http.post<EventResponse>(`${this.apiUrl}/${eventId}/reject`, {});
  }
}

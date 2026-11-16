import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  FinanceAppointmentResponse,
  FinanceSummaryResponse,
  FinanceTimelineResponse,
} from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/finance';

  summarize(calendarId: string, startDate: string, endDate: string) {
    return this.http.get<FinanceSummaryResponse>(`${this.apiUrl}/summary`, {
      params: this.rangeParams(calendarId, startDate, endDate),
    });
  }

  timeline(calendarId: string, startDate: string, endDate: string) {
    return this.http.get<FinanceTimelineResponse>(`${this.apiUrl}/timeline`, {
      params: this.rangeParams(calendarId, startDate, endDate),
    });
  }

  appointments(calendarId: string, startDate: string, endDate: string, limit = 8) {
    return this.http.get<FinanceAppointmentResponse[]>(`${this.apiUrl}/appointments`, {
      params: this.rangeParams(calendarId, startDate, endDate).set('limit', limit),
    });
  }

  exportReport(calendarIds: string[], startDate: string, endDate: string) {
    let params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    for (const calendarId of new Set(calendarIds)) params = params.append('calendarIds', calendarId);
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob', observe: 'response' });
  }

  private rangeParams(calendarId: string, startDate: string, endDate: string): HttpParams {
    return new HttpParams()
      .set('calendarId', calendarId)
      .set('startDate', startDate)
      .set('endDate', endDate);
  }
}

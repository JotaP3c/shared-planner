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

  private rangeParams(calendarId: string, startDate: string, endDate: string): HttpParams {
    return new HttpParams()
      .set('calendarId', calendarId)
      .set('startDate', startDate)
      .set('endDate', endDate);
  }
}

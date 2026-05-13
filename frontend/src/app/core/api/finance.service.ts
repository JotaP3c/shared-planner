import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { FinanceSummaryResponse } from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/finance';

  summarize(calendarId: string, startDate: string, endDate: string) {
    const params = new HttpParams()
      .set('calendarId', calendarId)
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<FinanceSummaryResponse>(`${this.apiUrl}/summary`, {
      params,
    });
  }
}

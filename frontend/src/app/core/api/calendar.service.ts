import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AddCalendarMemberRequest,
  CalendarResponse,
  CreateCalendarRequest,
} from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/calendars';

  list() {
    return this.http.get<CalendarResponse[]>(this.apiUrl);
  }

  create(request: CreateCalendarRequest) {
    return this.http.post<CalendarResponse>(this.apiUrl, request);
  }

  addMember(calendarId: string, request: AddCalendarMemberRequest) {
    return this.http.post<void>(`${this.apiUrl}/${calendarId}/members`, request);
  }
}

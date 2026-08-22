import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AddCalendarMemberRequest,
  CalendarMemberResponse,
  CalendarResponse,
  CreateCalendarRequest,
  UpdateCalendarMemberRequest,
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

  listMembers(calendarId: string) {
    return this.http.get<CalendarMemberResponse[]>(`${this.apiUrl}/${calendarId}/members`);
  }

  updateMember(calendarId: string, memberId: string, request: UpdateCalendarMemberRequest) {
    return this.http.put<CalendarMemberResponse>(`${this.apiUrl}/${calendarId}/members/${memberId}`, request);
  }

  removeMember(calendarId: string, memberId: string) {
    return this.http.delete<void>(`${this.apiUrl}/${calendarId}/members/${memberId}`);
  }
}

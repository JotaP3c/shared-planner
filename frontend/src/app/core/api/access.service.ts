import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AccessProfile, EffectiveAccess, PermissionDefinition, ProfileAssignment, ProfileRequest } from '../models/access.models';
import { UserResponse } from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/access';
  permissions() { return this.http.get<PermissionDefinition[]>(`${this.url}/permissions`); }
  profiles(calendarId?: string) { return this.http.get<AccessProfile[]>(`${this.url}/profiles`, { params: calendarId ? { calendarId } : {} }); }
  users() { return this.http.get<UserResponse[]>(`${this.url}/users`); }
  create(request: ProfileRequest) { return this.http.post<AccessProfile>(`${this.url}/profiles`, request); }
  update(id: string, request: ProfileRequest) { return this.http.put<AccessProfile>(`${this.url}/profiles/${id}`, request); }
  assignment(userId: string, calendarId?: string) { return this.http.get<ProfileAssignment>(`${this.url}/assignments`, { params: this.params(userId, calendarId) }); }
  assign(request: ProfileAssignment) { return this.http.put<ProfileAssignment>(`${this.url}/assignments`, request); }
  reset(userId: string, calendarId?: string) { return this.http.delete<void>(`${this.url}/assignments`, { params: this.params(userId, calendarId) }); }
  effective(userId?: string, calendarId?: string) {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (calendarId) params = params.set('calendarId', calendarId);
    return this.http.get<EffectiveAccess>(`${this.url}/effective`, { params });
  }
  private params(userId: string, calendarId?: string) {
    let params = new HttpParams().set('userId', userId);
    if (calendarId) params = params.set('calendarId', calendarId);
    return params;
  }
}

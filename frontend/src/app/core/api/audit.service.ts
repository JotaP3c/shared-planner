import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AuditEntityType,
  AuditLogResponse,
} from '../models/shared-planner.models';

export interface AuditSearchParams {
  calendarId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/audit-logs';

  search(filters: AuditSearchParams = {}) {
    let params = new HttpParams();

    if (filters.calendarId) {
      params = params.set('calendarId', filters.calendarId);
    }

    if (filters.entityType) {
      params = params.set('entityType', filters.entityType);
    }

    if (filters.entityId) {
      params = params.set('entityId', filters.entityId);
    }

    if (filters.limit) {
      params = params.set('limit', filters.limit);
    }

    return this.http.get<AuditLogResponse[]>(this.apiUrl, { params });
  }
}

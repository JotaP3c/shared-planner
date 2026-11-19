import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CatalogItemRequest, CatalogItemResponse, CatalogPageResponse, CatalogPriceHistory, CatalogQuery } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  list(calendarId: string, query: CatalogQuery = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<CatalogPageResponse>(this.url(calendarId), { params });
  }

  create(calendarId: string, item: CatalogItemRequest) {
    return this.http.post<CatalogItemResponse>(this.url(calendarId), item);
  }

  update(calendarId: string, itemId: string, item: CatalogItemRequest) {
    return this.http.put<CatalogItemResponse>(`${this.url(calendarId)}/${encodeURIComponent(itemId)}`, item);
  }

  priceHistory(calendarId: string, itemId: string, page = 0, size = 20) {
    return this.http.get<CatalogPriceHistory[]>(`${this.url(calendarId)}/${encodeURIComponent(itemId)}/price-history`, {
      params: { page, size },
    });
  }

  private url(calendarId: string): string {
    return `/api/calendars/${encodeURIComponent(calendarId)}/catalog`;
  }
}

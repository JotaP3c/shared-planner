export type CatalogType = 'SERVICE' | 'PRODUCT';

export interface CatalogItemRequest {
  name: string;
  type: CatalogType;
  code: string | null;
  description: string | null;
  standardPrice: number;
  promotionalPrice: number | null;
  promotionStartDate: string | null;
  promotionEndDate: string | null;
  durationMinutes: number | null;
  category: string | null;
  active: boolean;
  version?: number;
}

export interface CatalogItemResponse extends CatalogItemRequest {
  id: string;
  calendarId: string;
  version: number;
  effectivePrice: number;
  promotionApplied: boolean;
}

export interface CatalogQuery {
  q?: string;
  type?: CatalogType;
  active?: boolean;
  category?: string;
  appointmentDate?: string;
  page?: number;
  size?: number;
}

export interface CatalogPageResponse {
  items: CatalogItemResponse[];
  page: number;
  size: number;
  totalElements: number;
}

export interface CatalogPriceHistory {
  standardPrice: number;
  promotionalPrice: number | null;
  promotionStartDate: string | null;
  promotionEndDate: string | null;
  changedAt: string;
  changedByEmail: string;
}

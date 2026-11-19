import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogItemResponse } from '../../core/models/catalog.models';
import { CalendarResponse } from '../../core/models/shared-planner.models';
import { CatalogPage } from './catalog-page';

const first: CalendarResponse = {
  id: 'owned', name: 'Agenda própria', ownerEmail: 'owner@example.invalid', memberRole: 'ADMIN',
  canCreateEvents: true, permissions: ['CALENDAR_VIEW', 'FINANCE_VIEW', 'CATALOG_VIEW', 'CATALOG_MANAGE'],
};
const readOnly: CalendarResponse = {
  ...first, id: 'read', name: 'Agenda de consulta', memberRole: 'FINANCE',
  permissions: ['CALENDAR_VIEW', 'FINANCE_VIEW', 'CATALOG_VIEW'],
};
const denied: CalendarResponse = { ...first, id: 'denied', permissions: ['CALENDAR_VIEW', 'CATALOG_VIEW'] };
const item: CatalogItemResponse = {
  id: 'item', calendarId: 'owned', name: 'Procedimento', type: 'SERVICE', code: null, description: 'Descrição',
  category: null, durationMinutes: 45, standardPrice: 100, promotionalPrice: null, promotionStartDate: null,
  promotionEndDate: null, effectivePrice: 100, promotionApplied: false, active: true, version: 1,
};

describe('CatalogPage', () => {
  let fixture: ComponentFixture<CatalogPage>;
  let page: CatalogPage;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CatalogPage], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CatalogPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/calendars').flush([first, readOnly, denied]);
  });
  afterEach(() => http.verify());

  function list(id = 'owned', items: CatalogItemResponse[] = []) {
    const request = http.expectOne(req => req.method === 'GET' && req.url === `/api/calendars/${id}/catalog`);
    request.flush({ items, page: 0, size: 30, totalElements: items.length });
    return request.request.params;
  }

  it('filters by calendar grants and cancels an obsolete list request after changing calendars', () => {
    const pending = http.expectOne(req => req.url === '/api/calendars/owned/catalog');
    expect(page.calendars().map(calendar => calendar.id)).toEqual(['owned', 'read']);
    page.selectCalendar('read');
    expect(pending.cancelled).toBe(true);
    list('read');
    page.openForm();
    expect(page.formOpen()).toBe(false);
    page.selectCalendar('denied');
    expect(page.calendarId()).toBe('read');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Novo item');
  });

  it('creates a duration-free product, rejects incomplete promotion and sends the exact validated request', () => {
    list();
    page.openForm();
    page.form.patchValue({ name: ' Produto ', type: 'PRODUCT', standardPrice: 34.9, promotionalPrice: 29.9 });
    page.save();
    expect(page.formError()).toContain('período válido');
    http.expectNone(req => req.method === 'POST');
    page.form.patchValue({ promotionStartDate: '2030-03-01', promotionEndDate: '2030-03-31' });
    page.save();
    const request = http.expectOne('/api/calendars/owned/catalog');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ name: 'Produto', type: 'PRODUCT', standardPrice: 34.9,
      promotionalPrice: 29.9, durationMinutes: null, active: true, promotionEndDate: '2030-03-31' });
    request.flush({ ...item, name: 'Produto', type: 'PRODUCT' });
    list();
    expect(page.success()).toBe('Item cadastrado.');
  });

  it('edits with the version, preserves unsaved changes on conflict, and deactivates explicitly', () => {
    list('owned', [item]);
    page.openForm(item);
    page.form.patchValue({ standardPrice: 110 });
    page.save();
    const update = http.expectOne('/api/calendars/owned/catalog/item');
    expect(update.request.body).toMatchObject({ standardPrice: 110, version: 1, active: true });
    update.flush({}, { status: 409, statusText: 'Conflict' });
    expect(page.formOpen()).toBe(true);
    expect(page.form.controls.standardPrice.value).toBe(110);
    expect(page.formError()).toContain('Atualize a lista');
    page.cancelForm();
    page.toggleActive(item);
    const deactivate = http.expectOne('/api/calendars/owned/catalog/item');
    expect(deactivate.request.body).toMatchObject({ active: false, version: 1 });
    deactivate.flush({ ...item, active: false, version: 2 });
    list();
    expect(page.success()).toBe('Item desativado.');
  });

  it('loads filtered inactive services and contextual price history', () => {
    list();
    page.filters.setValue({ q: ' Procedimento ', category: ' Rosto ', status: 'inactive', type: 'SERVICE' });
    page.load();
    const params = list('owned', [{ ...item, active: false }]);
    expect(params.get('q')).toBe('Procedimento');
    expect(params.get('type')).toBe('SERVICE');
    expect(params.get('category')).toBe('Rosto');
    expect(params.get('active')).toBe('false');
    page.openHistory(item);
    http.expectOne(req => req.url === '/api/calendars/owned/catalog/item/price-history' && req.params.get('page') === '0')
      .flush([{ standardPrice: 75, changedAt: '2030-01-01T12:00:00', changedByEmail: 'owner@example.invalid' }]);
    expect(page.history()[0].standardPrice).toBe(75);
  });
});

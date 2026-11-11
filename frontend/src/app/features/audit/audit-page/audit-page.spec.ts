import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuditPage } from './audit-page';
import { AuthService } from '../../../core/auth/auth.service';
import { AuditLogResponse, UserResponse } from '../../../core/models/shared-planner.models';

describe('AuditPage', () => {
  let component: AuditPage;
  let fixture: ComponentFixture<AuditPage>;
  let http: HttpTestingController;

  const user = (role: UserResponse['role']): UserResponse => ({
    id: 'u', fullName: 'User', email: 'user@example.com', role, active: true, createdAt: '', updatedAt: '',
  });

  const log = (id: string): AuditLogResponse => ({
    id,
    entityType: 'EVENT',
    entityId: 'e1',
    calendarId: 'cal',
    action: 'APPOINTMENT_CONFIRMED',
    summary: 'Appointment confirmed: joao teste',
    oldValue: 'confirmationStatus=PENDING_CONFIRMATION',
    newValue: 'confirmationStatus=CONFIRMED',
    performedByEmail: 'admin@example.com',
    performedAt: '2026-11-11T15:00:00',
  });

  async function setup(role: UserResponse['role']) {
    await TestBed.configureTestingModule({
      imports: [AuditPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set(user(role));
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('loads real audit records for a global admin without exposing snapshots', async () => {
    await setup('ADMIN');
    http.expectOne('/api/calendars').flush([
      { id: 'cal', name: 'Agenda Principal', ownerEmail: 'admin@example.com', memberRole: null, canCreateEvents: true },
    ]);
    const request = http.expectOne(candidate => candidate.url === '/api/audit-logs');
    expect(request.request.params.has('calendarId')).toBe(false);
    expect(request.request.params.get('limit')).toBe('50');
    request.flush([log('a')]);
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('[data-testid="audit-table"]') as HTMLElement;
    expect(table.textContent).toContain('Atendimento confirmado');
    expect(table.textContent).toContain('Agenda Principal');
    expect(table.textContent).not.toContain('confirmationStatus=');
  });

  it('scopes a calendar admin to their own calendar and applies filters', async () => {
    await setup('USER');
    http.expectOne('/api/calendars').flush([
      { id: 'mine', name: 'Minha', ownerEmail: 'user@example.com', memberRole: 'ADMIN', canCreateEvents: true },
      { id: 'other', name: 'Outra', ownerEmail: 'x@example.com', memberRole: 'VIEWER', canCreateEvents: false },
    ]);
    expect(component.calendarOptions().map(item => item.id)).toEqual(['mine']);
    http.expectOne(candidate => candidate.url === '/api/audit-logs' && candidate.params.get('calendarId') === 'mine')
      .flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="audit-empty"]')).not.toBeNull();

    component.selectEntityType('EVENT');
    const filtered = http.expectOne(candidate => candidate.url === '/api/audit-logs');
    expect(filtered.request.params.get('entityType')).toBe('EVENT');
    filtered.flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="audit-error"]')?.textContent).toContain('permissão');
  });
});

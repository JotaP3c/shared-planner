import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PendingPage } from './pending-page';
import { AuthService } from '../../../core/auth/auth.service';
import { EventResponse } from '../../../core/models/shared-planner.models';
import { DataChangeService } from '../../../core/state/data-change.service';

describe('PendingPage', () => {
  let component: PendingPage;
  let fixture: ComponentFixture<PendingPage>;
  let http: HttpTestingController;

  function pending(id: string): EventResponse {
    return {
      id,
      calendarId: 'calendar',
      createdByEmail: 'owner@example.com',
      approvalRequestedFromEmail: 'user@example.com',
      approvedByEmail: null,
      eventType: 'SHARED',
      status: 'PENDING_APPROVAL',
      title: `Evento ${id}`,
      clientName: null,
      personName: null,
      description: null,
      workDescription: null,
      startsAt: '2026-08-24T10:00:00',
      endsAt: '2026-08-24T11:00:00',
    };
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set({
      id: 'user', fullName: 'User', email: 'user@example.com', role: 'USER', active: true, createdAt: '', updatedAt: '',
    });
    fixture = TestBed.createComponent(PendingPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows loading, not the empty state, while the queue is loading (BLG-BUG-008)', () => {
    expect(text()).toContain('Carregando pendências');
    expect(text()).not.toContain('Nenhuma pendência encontrada');

    http.expectOne('/api/events/pending-approvals').flush([]);
    fixture.detectChanges();

    expect(text()).toContain('Nenhuma pendência encontrada');
  });

  it('shows a load error with retry instead of an empty queue', () => {
    http.expectOne('/api/events/pending-approvals').flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.loadError()).toBeTruthy();
    expect(text()).not.toContain('Nenhuma pendência encontrada');
    expect(fixture.nativeElement.querySelector('[data-testid="pending-load-error"] button')).not.toBeNull();
  });

  it('keeps each concurrent action locked until its own request finishes', () => {
    http.expectOne('/api/events/pending-approvals').flush([pending('a'), pending('b')]);

    component.approve(pending('a'));
    component.approve(pending('b'));
    http.expectOne('/api/events/a/approve').flush({ ...pending('a'), status: 'APPROVED' });

    expect(component.isActionInProgress('a')).toBe(false);
    expect(component.isActionInProgress('b')).toBe(true);
    expect(component.pendingEvents().map(item => item.id)).toEqual(['b']);

    component.approve(pending('b'));
    http.expectOne('/api/events/b/approve').flush({ ...pending('b'), status: 'APPROVED' });
    expect(component.pendingEvents()).toEqual([]);
  });

  it('ignores a stale reload that would resurrect an already decided item', () => {
    http.expectOne('/api/events/pending-approvals').flush([pending('a')]);

    component.loadPendingEvents();
    const reload = http.expectOne('/api/events/pending-approvals');
    component.approve(pending('a'));
    http.expectOne('/api/events/a/approve').flush({ ...pending('a'), status: 'APPROVED' });
    reload.flush([pending('a')]);

    expect(component.pendingEvents()).toEqual([]);
  });

  it('shows a reopened item on a fresh reload after it was decided', () => {
    http.expectOne('/api/events/pending-approvals').flush([pending('a')]);
    component.approve(pending('a'));
    http.expectOne('/api/events/a/approve').flush({ ...pending('a'), status: 'APPROVED' });
    expect(component.pendingEvents()).toEqual([]);

    component.loadPendingEvents();
    http.expectOne('/api/events/pending-approvals').flush([pending('a')]);

    expect(component.pendingEvents().map(item => item.id)).toEqual(['a']);
  });

  it('notifies data changes after a decision so counters and summaries refresh', () => {
    const changes = TestBed.inject(DataChangeService);
    http.expectOne('/api/events/pending-approvals').flush([pending('a')]);
    const before = changes.version();

    component.approve(pending('a'));
    http.expectOne('/api/events/a/approve').flush({ ...pending('a'), status: 'APPROVED' });

    expect(changes.version()).toBe(before + 1);
  });

  it('does not offer actions to someone who is not the requested approver', () => {
    http.expectOne('/api/events/pending-approvals').flush([
      { ...pending('a'), approvalRequestedFromEmail: 'other@example.com' },
    ]);
    fixture.detectChanges();

    expect(component.canRespond(component.pendingEvents()[0])).toBe(false);
    expect(fixture.nativeElement.querySelector('.save-button')).toBeNull();
  });
});

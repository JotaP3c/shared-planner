import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UsersPage } from './users-page';
import { AuthService } from '../../../core/auth/auth.service';
import { UserResponse } from '../../../core/models/shared-planner.models';

describe('UsersPage', () => {
  let component: UsersPage;
  let fixture: ComponentFixture<UsersPage>;
  let http: HttpTestingController;

  const user = (id: string, overrides: Partial<UserResponse> = {}): UserResponse => ({
    id,
    fullName: `Pessoa ${id}`,
    email: `${id}@example.com`,
    role: 'USER',
    active: true,
    createdAt: '2026-08-21T10:00:00',
    updatedAt: '2026-08-21T10:00:00',
    ...overrides,
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set(user('admin', { role: 'ADMIN', fullName: 'Admin' }));
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows loading and then the list', () => {
    expect(text()).toContain('Carregando usuários');

    http.expectOne('/api/users').flush([user('admin', { role: 'ADMIN' }), user('ana')]);
    fixture.detectChanges();

    expect(component.users()).toHaveLength(2);
    expect(text()).toContain('ana@example.com');
    expect(text()).not.toContain('Carregando usuários');
  });

  it('shows the empty state for an empty list', () => {
    http.expectOne('/api/users').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="users-empty"]')).not.toBeNull();
  });

  it('shows a load error with retry and does not show the empty state', () => {
    http.expectOne('/api/users').flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.loadError()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="users-empty"]')).toBeNull();

    component.loadUsers();
    http.expectOne('/api/users').flush([user('ana')]);
    expect(component.loadError()).toBe('');
    expect(component.users()).toHaveLength(1);
  });

  it('shows access denied (403) without a retry or create action', () => {
    http.expectOne('/api/users').flush('x', { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(component.accessDenied()).toBe(true);
    expect(text()).toContain('permissão');
    expect(fixture.nativeElement.querySelector('[data-testid="open-create-user"]')).toBeNull();
  });

  it('filters locally by name or e-mail', () => {
    http.expectOne('/api/users').flush([user('ana'), user('bruno')]);

    component.onSearch('BRUNO@');
    expect(component.filteredUsers().map(item => item.id)).toEqual(['bruno']);

    component.onSearch('zzz');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="users-empty"]')).not.toBeNull();
  });

  it('does not send an invalid creation request', () => {
    http.expectOne('/api/users').flush([]);
    component.openCreate();
    component.createForm.patchValue({ fullName: '   ', email: 'invalido', password: '123' });

    component.submitCreate();

    http.expectNone(request => request.method === 'POST');
    expect(component.createForm.invalid).toBe(true);
  });

  it('creates a user and keeps the list sorted', () => {
    http.expectOne('/api/users').flush([user('bruno')]);
    component.openCreate();
    component.createForm.setValue({ fullName: ' Ana Lima ', email: 'ana@example.com', password: 'secret1', role: 'FINANCE' });

    component.submitCreate();
    const request = http.expectOne(candidate => candidate.method === 'POST' && candidate.url === '/api/users');
    expect(request.request.body).toEqual({
      fullName: 'Ana Lima', email: 'ana@example.com', password: 'secret1', role: 'FINANCE',
    });
    request.flush(user('ana', { fullName: 'Ana Lima', role: 'FINANCE' }));

    expect(component.users().map(item => item.fullName)).toEqual(['Ana Lima', 'Pessoa bruno']);
    expect(component.panelMode()).toBe('closed');
    expect(component.isSaving()).toBe(false);
  });

  it('reports a duplicate e-mail (409) and keeps the form open', () => {
    http.expectOne('/api/users').flush([]);
    component.openCreate();
    component.createForm.setValue({ fullName: 'Ana', email: 'ana@example.com', password: 'secret1', role: 'USER' });

    component.submitCreate();
    http.expectOne('/api/users').flush({}, { status: 409, statusText: 'Conflict' });

    expect(component.formError()).toContain('e-mail');
    expect(component.panelMode()).toBe('create');
    expect(component.isSaving()).toBe(false);
  });

  it('edits name, role and active status of another user', () => {
    http.expectOne('/api/users').flush([user('ana')]);
    component.openEdit(component.users()[0]);
    component.editForm.setValue({ fullName: 'Ana Souza', role: 'FINANCE', active: false });

    component.submitEdit();
    const request = http.expectOne('/api/users/ana');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ fullName: 'Ana Souza', role: 'FINANCE', active: false });
    request.flush(user('ana', { fullName: 'Ana Souza', role: 'FINANCE', active: false }));

    expect(component.users()[0].active).toBe(false);
  });

  it('protects the authenticated admin from deactivating or demoting themselves', () => {
    http.expectOne('/api/users').flush([user('admin', { role: 'ADMIN', fullName: 'Admin' })]);
    component.openEdit(component.users()[0]);
    fixture.detectChanges();

    expect(component.isEditingSelf()).toBe(true);
    expect(component.editForm.controls.role.disabled).toBe(true);
    expect(component.editForm.controls.active.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="self-protection-note"]')).not.toBeNull();

    component.editForm.patchValue({ fullName: 'Admin Renomeado' });
    component.submitEdit();
    const request = http.expectOne('/api/users/admin');
    expect(request.request.body).toEqual({ fullName: 'Admin Renomeado', role: 'ADMIN', active: true });
    request.flush(user('admin', { role: 'ADMIN', fullName: 'Admin Renomeado' }));
  });

  it('offers pencil and trash actions with accessible names (INC-04)', () => {
    http.expectOne('/api/users').flush([user('admin', { role: 'ADMIN', fullName: 'Admin' }), user('ana')]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    const edit = element.querySelector('[data-testid="edit-user-ana"]') as HTMLButtonElement;
    expect(edit.getAttribute('aria-label')).toBe('Editar Pessoa ana');
    expect(edit.title).toBe('Editar');
    edit.click();
    expect(component.panelMode()).toBe('edit');

    const ownTrash = element.querySelector('[data-testid="deactivate-user-admin"]') as HTMLButtonElement;
    expect(ownTrash.disabled).toBe(true);
  });

  it('deactivates another user logically only after confirmation, and can reactivate', () => {
    http.expectOne('/api/users').flush([user('ana')]);
    fixture.detectChanges();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    (fixture.nativeElement.querySelector('[data-testid="deactivate-user-ana"]') as HTMLButtonElement).click();
    http.expectNone('/api/users/ana');

    confirmSpy.mockReturnValue(true);
    (fixture.nativeElement.querySelector('[data-testid="deactivate-user-ana"]') as HTMLButtonElement).click();
    const request = http.expectOne('/api/users/ana');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ fullName: 'Pessoa ana', role: 'USER', active: false });
    request.flush(user('ana', { active: false }));
    fixture.detectChanges();

    expect(component.users()[0].active).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="reactivate-user-ana"]')).not.toBeNull();

    (fixture.nativeElement.querySelector('[data-testid="reactivate-user-ana"]') as HTMLButtonElement).click();
    http.expectOne('/api/users/ana').flush(user('ana', { active: true }));
    expect(component.users()[0].active).toBe(true);
    confirmSpy.mockRestore();
  });

  it('shows the last-administrator protection message on 409', () => {
    http.expectOne('/api/users').flush([user('ana', { role: 'ADMIN' })]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.setActive(component.users()[0], false);
    http.expectOne('/api/users/ana').flush(
      { detail: 'At least one active administrator is required' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(component.actionError()).toContain('ao menos um administrador ativo');
    expect(component.users()[0].active).toBe(true);
    vi.restoreAllMocks();
  });

  it('surfaces the backend refusal when the update is rejected', () => {
    http.expectOne('/api/users').flush([user('ana')]);
    component.openEdit(component.users()[0]);

    component.submitEdit();
    http.expectOne('/api/users/ana').flush({ detail: 'Acesso negado' }, { status: 403, statusText: 'Forbidden' });

    expect(component.formError()).toContain('permissão');
    expect(component.users()[0].role).toBe('USER');
  });
});

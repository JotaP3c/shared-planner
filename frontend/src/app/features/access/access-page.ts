import { SpButtonDirective, SpInputDirective, SpSelectDirective, SpCheckboxDirective, SpLoadingState } from '../../shared/ui/design-system';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, Observable, Subscription } from 'rxjs';
import { AccessService } from '../../core/api/access.service';
import { CalendarService } from '../../core/api/calendar.service';
import { AuthService } from '../../core/auth/auth.service';
import { canGlobalPermission } from '../../core/auth/calendar-permissions';
import { AccessProfile, EffectiveAccess, Permission, PermissionDefinition } from '../../core/models/access.models';
import { CalendarResponse, UserResponse } from '../../core/models/shared-planner.models';
import { DataChangeService } from '../../core/state/data-change.service';

@Component({
  imports: [SpButtonDirective, SpInputDirective, SpSelectDirective, SpCheckboxDirective, SpLoadingState],
  selector: 'app-access-page', templateUrl: './access-page.html', styleUrl: './access-page.scss',
})
export class AccessPage implements OnInit {
  private readonly api = inject(AccessService);
  private readonly calendarApi = inject(CalendarService);
  private readonly auth = inject(AuthService);
  private readonly changes = inject(DataChangeService);
  private readonly destroyRef = inject(DestroyRef);
  private assignmentSubscription?: Subscription;
  private assignmentRequest = 0;
  readonly allowed = computed(() => canGlobalPermission(this.auth.currentUser(), 'ROLES_MANAGE'));
  readonly profiles = signal<AccessProfile[]>([]);
  readonly catalog = signal<PermissionDefinition[]>([]);
  readonly users = signal<UserResponse[]>([]);
  readonly calendars = signal<CalendarResponse[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal('');
  readonly name = signal('');
  readonly scope = signal<'GLOBAL' | 'CALENDAR'>('CALENDAR');
  readonly active = signal(true);
  readonly grants = signal<Permission[]>([]);
  readonly protectedProfile = computed(() => this.profiles().find(p => p.id === this.editingId())?.code === 'SYSTEM_ADMIN');
  readonly scopeCatalog = computed(() => this.catalog().filter(p => this.scope() === 'GLOBAL' || !p.globalOnly));
  readonly selectedUserId = signal('');
  readonly selectedCalendarId = signal('');
  readonly assignmentIds = signal<string[]>([]);
  readonly explicitAssignment = signal(false);
  readonly effective = signal<EffectiveAccess | null>(null);
  readonly loadingAssignment = signal(false);
  readonly savingAssignment = signal(false);
  readonly assignmentProfiles = computed(() => this.profiles().filter(p => p.scope === (this.selectedCalendarId() ? 'CALENDAR' : 'GLOBAL')));
  readonly effectiveGrants = computed(() => {
    const result = this.effective();
    return this.selectedCalendarId() ? result?.calendars.find(c => c.calendarId === this.selectedCalendarId())?.permissions ?? []
      : result?.globalPermissions ?? [];
  });
  ngOnInit(): void { this.load(); }
  load(): void {
    if (!this.allowed()) { this.error.set('Você não tem permissão para gerenciar perfis.'); return; }
    this.loading.set(true); this.error.set('');
    forkJoin({ catalog: this.api.permissions(), profiles: this.api.profiles(), users: this.api.users(), calendars: this.calendarApi.list() })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: result => {
        this.catalog.set(result.catalog); this.profiles.set(result.profiles); this.users.set(result.users); this.calendars.set(result.calendars);
        if (this.editingId()) { const profile = result.profiles.find(p => p.id === this.editingId()); if (profile) this.edit(profile); }
      }, error: error => this.error.set(this.errorText(error, 'Não foi possível carregar os perfis.')) });
  }
  edit(profile: AccessProfile): void {
    this.editingId.set(profile.id); this.name.set(profile.name); this.scope.set(profile.scope);
    this.active.set(profile.active); this.grants.set([...profile.permissions]); this.error.set('');
  }
  newProfile(): void { this.editingId.set(''); this.name.set(''); this.scope.set('CALENDAR'); this.active.set(true); this.grants.set([]); this.error.set(''); }
  setScope(value: string): void {
    if (this.editingId()) return;
    this.scope.set(value === 'GLOBAL' ? 'GLOBAL' : 'CALENDAR');
    this.grants.update(grants => grants.filter(code => this.scopeCatalog().some(p => p.code === code)));
  }
  togglePermission(code: Permission, checked: boolean): void {
    if (!this.allowed() || this.protectedProfile()) return;
    this.grants.update(grants => checked ? [...new Set([...grants, code])] : grants.filter(p => p !== code));
  }
  saveProfile(): void {
    if (!this.allowed() || this.saving() || this.protectedProfile() || !this.name().trim()) return;
    this.error.set(''); this.success.set(''); this.saving.set(true);
    const body = { name: this.name().trim(), scope: this.scope(), active: this.active(), permissions: this.grants() };
    const request = this.editingId() ? this.api.update(this.editingId(), body) : this.api.create(body);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: profile => { this.edit(profile); this.success.set('Perfil salvo. As permissões serão reavaliadas nas próximas operações.'); this.load(); this.notifyAccessChange(); },
      error: error => this.error.set(this.errorText(error, 'Não foi possível salvar o perfil.')),
    });
  }
  selectUser(id: string): void { this.selectedUserId.set(id); this.loadAssignment(); }
  selectCalendar(id: string): void { this.selectedCalendarId.set(id); this.loadAssignment(); }
  toggleAssignment(id: string, checked: boolean): void {
    if (checked && !this.assignmentProfiles().some(profile => profile.id === id && profile.active)) return;
    this.assignmentIds.update(ids => checked ? [...new Set([...ids, id])] : ids.filter(current => current !== id));
  }
  loadAssignment(): void {
    const requestId = ++this.assignmentRequest;
    this.assignmentSubscription?.unsubscribe(); this.assignmentIds.set([]); this.effective.set(null); this.explicitAssignment.set(false);
    const userId = this.selectedUserId();
    if (!userId) { this.loadingAssignment.set(false); return; }
    this.loadingAssignment.set(true); this.error.set('');
    this.assignmentSubscription = forkJoin({ assignment: this.api.assignment(userId, this.selectedCalendarId() || undefined), effective: this.api.effective(userId, this.selectedCalendarId() || undefined) })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (requestId === this.assignmentRequest) this.loadingAssignment.set(false); }))
      .subscribe({ next: result => { if (requestId !== this.assignmentRequest) return; this.assignmentIds.set(result.assignment.profileIds); this.explicitAssignment.set(result.assignment.explicit === true); this.effective.set(result.effective); },
        error: error => { if (requestId === this.assignmentRequest) this.error.set(this.errorText(error, 'Não foi possível consultar os acessos.')); } });
  }
  saveAssignment(reset = false): void {
    if (!this.allowed() || !this.selectedUserId() || this.loadingAssignment() || this.savingAssignment() || !this.effective()) return;
    const userId = this.selectedUserId(), calendarId = this.selectedCalendarId();
    this.savingAssignment.set(true); this.error.set(''); this.success.set('');
    const request: Observable<unknown> = reset ? this.api.reset(userId, calendarId || undefined)
      : this.api.assign({ userId, calendarId: calendarId || null, profileIds: this.assignmentIds() });
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.savingAssignment.set(false))).subscribe({
      next: () => { this.success.set(reset ? 'Perfis padrão restaurados.' : 'Associação salva.'); if (userId === this.selectedUserId() && calendarId === this.selectedCalendarId()) this.loadAssignment(); this.notifyAccessChange(); },
      error: error => this.error.set(this.errorText(error, 'Não foi possível alterar a associação.')),
    });
  }
  permissionLabel(code: Permission): string { return this.catalog().find(p => p.code === code)?.label ?? code; }
  private notifyAccessChange(): void { this.changes.notify(); this.auth.loadCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(); }
  private errorText(error: unknown, fallback: string): string {
    const status = (error as { status?: number })?.status;
    if (status === 403) return 'Você não tem permissão para executar esta operação.';
    if (status === 409) return 'Esta alteração comprometeria um administrador essencial ou um acesso protegido.';
    if (status === 400) return 'Confira o escopo, as permissões e os perfis selecionados. O usuário deve ser membro do calendário.';
    return fallback;
  }
}

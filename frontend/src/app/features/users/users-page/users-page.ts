import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { UserService } from '../../../core/api/user.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UserResponse, UserRole } from '../../../core/models/shared-planner.models';
import { Icon } from '../../../shared/ui/icon/icon';

type PanelMode = 'closed' | 'create' | 'edit';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private loadRequestId = 0;

  readonly roles: UserRole[] = ['ADMIN', 'FINANCE', 'USER'];
  readonly currentUser = this.authService.currentUser;
  readonly users = signal<UserResponse[]>([]);
  readonly searchTerm = signal('');
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  /** Falha ao carregar a lista (inclusive acesso negado); distinta de lista vazia. */
  readonly loadError = signal('');
  readonly accessDenied = signal(false);
  readonly isSaving = signal(false);
  readonly formError = signal('');
  /** Erro de ação na linha (desativar/reativar), distinto de falha de carregamento. */
  readonly actionError = signal('');
  readonly successMessage = signal('');
  readonly panelMode = signal<PanelMode>('closed');
  readonly editingUser = signal<UserResponse | null>(null);

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const users = this.users();

    if (!term) {
      return users;
    }

    return users.filter(user =>
      user.fullName.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  });

  readonly showEmptyState = computed(() =>
    this.hasLoaded() && !this.isLoading() && !this.loadError() && this.filteredUsers().length === 0,
  );

  readonly isEditingSelf = computed(() => {
    const editing = this.editingUser();
    return !!editing && this.isSelf(editing);
  });

  readonly createForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120), this.notBlank]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(180)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    role: ['USER' as UserRole, [Validators.required]],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120), this.notBlank]],
    role: ['USER' as UserRole, [Validators.required]],
    active: [true],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    const requestId = ++this.loadRequestId;

    this.loadError.set('');
    this.accessDenied.set(false);
    this.isLoading.set(true);

    this.userService
      .list()
      .pipe(finalize(() => {
        if (requestId === this.loadRequestId) {
          this.isLoading.set(false);
        }
      }))
      .subscribe({
        next: users => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.users.set(users);
          this.hasLoaded.set(true);
        },
        error: error => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          if (error?.status === 403) {
            this.accessDenied.set(true);
            this.loadError.set('Você não tem permissão para gerenciar usuários.');
            return;
          }

          this.loadError.set('Não foi possível carregar os usuários.');
        },
      });
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openCreate(): void {
    this.clearFeedback();
    this.createForm.reset({ fullName: '', email: '', password: '', role: 'USER' });
    this.editingUser.set(null);
    this.panelMode.set('create');
  }

  openEdit(user: UserResponse): void {
    this.clearFeedback();
    this.editForm.reset({ fullName: user.fullName, role: user.role, active: user.active });
    this.editingUser.set(user);
    this.panelMode.set('edit');

    // Autoproteção visual: o backend também recusa desativar ou rebaixar o próprio ADMIN.
    if (this.isSelf(user)) {
      this.editForm.controls.role.disable();
      this.editForm.controls.active.disable();
    } else {
      this.editForm.controls.role.enable();
      this.editForm.controls.active.enable();
    }
  }

  closePanel(): void {
    this.panelMode.set('closed');
    this.editingUser.set(null);
    this.formError.set('');
  }

  submitCreate(): void {
    if (this.isSaving()) {
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.getRawValue();
    this.formError.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    this.userService
      .create({
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        password: raw.password,
        role: raw.role,
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: created => {
          this.users.update(users => this.sortUsers([...users, created]));
          this.successMessage.set(`Usuário ${created.fullName} criado.`);
          this.closePanel();
        },
        error: error => this.formError.set(this.errorText(error, 'Não foi possível criar o usuário.')),
      });
  }

  submitEdit(): void {
    const user = this.editingUser();

    if (!user || this.isSaving()) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue();
    this.formError.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    this.userService
      .update(user.id, {
        fullName: raw.fullName.trim(),
        // Para o próprio ADMIN, papel e status permanecem os atuais (campos desabilitados).
        role: this.isSelf(user) ? user.role : raw.role,
        active: this.isSelf(user) ? user.active : raw.active,
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: updated => {
          this.users.update(users =>
            this.sortUsers(users.map(item => (item.id === updated.id ? updated : item))),
          );
          this.successMessage.set(`Usuário ${updated.fullName} atualizado.`);
          this.closePanel();
        },
        error: error => this.formError.set(this.errorText(error, 'Não foi possível atualizar o usuário.')),
      });
  }

  /**
   * Lixeira = desativação lógica (INC-04): exclusão física quebraria eventos, calendários,
   * auditoria e cadastros que referenciam o usuário. Reativação usa o mesmo contrato.
   */
  setActive(user: UserResponse, active: boolean): void {
    if (this.isSaving() || (!active && this.isSelf(user))) {
      return;
    }

    const question = active
      ? `Reativar a conta de ${user.fullName}?`
      : `Desativar a conta de ${user.fullName}? A pessoa não conseguirá mais entrar, mas o histórico é mantido.`;

    if (!window.confirm(question)) {
      return;
    }

    this.clearFeedback();
    this.isSaving.set(true);

    this.userService
      .update(user.id, { fullName: user.fullName, role: user.role, active })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: updated => {
          this.users.update(users => users.map(item => (item.id === updated.id ? updated : item)));
          this.successMessage.set(active ? `Conta de ${updated.fullName} reativada.` : `Conta de ${updated.fullName} desativada.`);

          if (this.editingUser()?.id === updated.id) {
            this.closePanel();
          }
        },
        error: error => this.actionError.set(this.errorText(error, 'Não foi possível alterar a situação da conta.')),
      });
  }

  isSelf(user: UserResponse): boolean {
    const me = this.currentUser();
    return !!me && me.email.toLowerCase() === user.email.toLowerCase();
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      ADMIN: 'Administrador',
      FINANCE: 'Financeiro',
      USER: 'Usuário',
    };

    return labels[role] ?? role;
  }

  showError(form: 'create' | 'edit', control: string, error: string): boolean {
    const group: FormGroup = form === 'create' ? this.createForm : this.editForm;
    const field = group.get(control);
    return !!field && field.touched && field.hasError(error);
  }

  private errorText(error: unknown, fallback: string): string {
    const status = (error as { status?: number })?.status;

    if (status === 409) {
      const detail = (error as { error?: { detail?: string } })?.error?.detail ?? '';
      return detail.includes('administrator')
        ? 'É necessário manter ao menos um administrador ativo.'
        : 'Já existe um usuário com este e-mail.';
    }

    if (status === 403) {
      return 'Você não tem permissão para esta operação.';
    }

    if (status === 400) {
      const body = (error as { error?: { detail?: string } })?.error;
      return body?.detail || 'Dados inválidos. Revise os campos e tente novamente.';
    }

    return fallback;
  }

  private sortUsers(users: UserResponse[]): UserResponse[] {
    return [...users].sort((left, right) => left.fullName.localeCompare(right.fullName, 'pt-BR'));
  }

  private clearFeedback(): void {
    this.formError.set('');
    this.actionError.set('');
    this.successMessage.set('');
  }

  private notBlank(control: { value: unknown }): { blank: true } | null {
    return typeof control.value === 'string' && control.value.trim().length === 0 && control.value.length > 0
      ? { blank: true }
      : null;
  }
}

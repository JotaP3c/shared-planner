import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { EventService } from '../../../core/api/event.service';
import {
  AppointmentConfirmationStatus,
  ConfirmationHistoryResponse,
  EventResponse,
  UnscheduleReason,
} from '../../../core/models/shared-planner.models';
import { Icon } from '../../../shared/ui/icon/icon';

const STATUS_LABELS: Record<AppointmentConfirmationStatus, string> = {
  PENDING_CONFIRMATION: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Desmarcado',
  RESCHEDULED: 'Remarcado',
};

const REASON_LABELS: Record<UnscheduleReason, string> = {
  RESCHEDULE: 'Remarcação',
  GAVE_UP: 'Desistência / apenas desmarcou',
  OTHER: 'Outros',
};

/**
 * Seção "Confirmação do atendimento" (somente CLIENT). Confirmação do cliente é
 * independente do pagamento; abrir o modal nunca confirma nada. Todas as mudanças passam
 * por confirmação explícita e são validadas/autorizadas pelo backend.
 */
@Component({
  selector: 'app-appointment-confirmation',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './appointment-confirmation.html',
})
export class AppointmentConfirmation {
  private readonly eventService = inject(EventService);
  private readonly formBuilder = inject(FormBuilder);

  readonly event = input.required<EventResponse>();
  /** Mesma regra de edição do evento; o backend continua sendo a autoridade. */
  readonly canManage = input(false);
  readonly updated = output<EventResponse>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly isUnscheduleFormOpen = signal(false);
  readonly history = signal<ConfirmationHistoryResponse[] | null>(null);
  readonly isHistoryOpen = signal(false);
  readonly isHistoryLoading = signal(false);
  readonly historyError = signal('');

  readonly reasons: ReadonlyArray<{ value: UnscheduleReason; label: string }> = [
    { value: 'RESCHEDULE', label: REASON_LABELS.RESCHEDULE },
    { value: 'GAVE_UP', label: REASON_LABELS.GAVE_UP },
    { value: 'OTHER', label: REASON_LABELS.OTHER },
  ];

  readonly unscheduleForm = this.formBuilder.nonNullable.group({
    reason: ['' as UnscheduleReason | '', Validators.required],
    notes: ['', Validators.maxLength(500)],
    newDate: [''],
    newStartTime: [''],
    newEndTime: [''],
  });

  readonly selectedReason = signal<UnscheduleReason | ''>('');

  readonly status = computed<AppointmentConfirmationStatus>(() =>
    this.event().confirmationStatus ?? 'PENDING_CONFIRMATION',
  );

  readonly statusLabel = computed(() => STATUS_LABELS[this.status()]);

  readonly canConfirm = computed(() =>
    this.canManage()
      && this.event().status !== 'CANCELLED'
      && (this.status() === 'PENDING_CONFIRMATION' || this.status() === 'RESCHEDULED'),
  );

  readonly canUnschedule = computed(() =>
    this.canManage() && this.event().status !== 'CANCELLED' && this.status() !== 'CANCELLED',
  );

  readonly changedLabel = computed(() =>
    this.status() === 'CONFIRMED' ? 'Confirmado em' : 'Atualizado em',
  );

  reasonLabel(reason: UnscheduleReason | null | undefined): string {
    return reason ? REASON_LABELS[reason] : '—';
  }

  statusText(status: AppointmentConfirmationStatus | null): string {
    return status ? STATUS_LABELS[status] : 'Sem registro';
  }

  formatDateTime(value: string | null | undefined): string {
    return value
      ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
  }

  confirm(): void {
    if (!this.canConfirm() || this.isSaving()) {
      return;
    }

    if (!window.confirm('Confirmar que o cliente comparecerá a este atendimento? O pagamento não muda.')) {
      return;
    }

    this.run(this.eventService.confirmAppointment(this.event().id), 'Atendimento confirmado.');
  }

  openUnscheduleForm(): void {
    const event = this.event();
    this.clearMessages();
    this.unscheduleForm.reset({
      reason: '',
      notes: '',
      newDate: event.startsAt.slice(0, 10),
      newStartTime: event.startsAt.slice(11, 16),
      newEndTime: event.endsAt.slice(11, 16),
    });
    this.selectedReason.set('');
    this.isUnscheduleFormOpen.set(true);
  }

  closeUnscheduleForm(): void {
    this.isUnscheduleFormOpen.set(false);
    this.errorMessage.set('');
  }

  selectReason(reason: UnscheduleReason): void {
    this.unscheduleForm.controls.reason.setValue(reason);
    this.selectedReason.set(reason);
    this.errorMessage.set('');
  }

  submitUnschedule(): void {
    if (this.isSaving()) {
      return;
    }

    const raw = this.unscheduleForm.getRawValue();
    const notes = raw.notes.trim();

    if (!raw.reason) {
      this.errorMessage.set('Selecione o motivo da desmarcação.');
      return;
    }

    if (raw.reason === 'OTHER' && !notes) {
      this.errorMessage.set('Descreva o motivo em "Outros".');
      return;
    }

    let newStartsAt: string | null = null;
    let newEndsAt: string | null = null;

    if (raw.reason === 'RESCHEDULE') {
      if (!raw.newDate || !raw.newStartTime || !raw.newEndTime) {
        this.errorMessage.set('Informe a nova data e os horários da remarcação.');
        return;
      }

      newStartsAt = `${raw.newDate}T${raw.newStartTime}:00`;
      newEndsAt = `${raw.newDate}T${raw.newEndTime}:00`;

      if (newEndsAt <= newStartsAt) {
        this.errorMessage.set('O horário final precisa ser depois do inicial.');
        return;
      }

      if (newStartsAt === this.event().startsAt.slice(0, 19) && newEndsAt === this.event().endsAt.slice(0, 19)) {
        this.errorMessage.set('Escolha uma data ou horário diferente do atual.');
        return;
      }
    }

    const question = raw.reason === 'RESCHEDULE'
      ? 'Remarcar este atendimento para a nova data? Nenhuma cobrança nova será criada.'
      : 'Desmarcar este atendimento? Pagamentos já registrados serão mantidos.';

    if (!window.confirm(question)) {
      return;
    }

    this.run(
      this.eventService.unscheduleAppointment(this.event().id, {
        reason: raw.reason,
        notes: notes || null,
        newStartsAt,
        newEndsAt,
      }),
      raw.reason === 'RESCHEDULE' ? 'Atendimento remarcado.' : 'Atendimento desmarcado.',
      () => this.isUnscheduleFormOpen.set(false),
    );
  }

  toggleHistory(): void {
    const open = !this.isHistoryOpen();
    this.isHistoryOpen.set(open);

    if (open) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.isHistoryLoading.set(true);
    this.historyError.set('');
    this.eventService.confirmationHistory(this.event().id)
      .pipe(finalize(() => this.isHistoryLoading.set(false)))
      .subscribe({
        next: history => this.history.set(history),
        error: () => this.historyError.set('Não foi possível carregar o histórico.'),
      });
  }

  private run(
    request: ReturnType<EventService['confirmAppointment']>,
    success: string,
    onSuccess?: () => void,
  ): void {
    this.clearMessages();
    this.isSaving.set(true);

    request.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: updated => {
        this.successMessage.set(success);
        onSuccess?.();
        this.updated.emit(updated);

        if (this.isHistoryOpen()) {
          this.loadHistory();
        }
      },
      error: error => this.errorMessage.set(this.errorText(error)),
    });
  }

  private errorText(error: unknown): string {
    const status = (error as { status?: number })?.status;

    if (status === 403) {
      return 'Você não tem permissão para alterar a confirmação deste atendimento.';
    }

    if (status === 409) {
      return 'A situação do atendimento mudou e esta ação não é mais permitida. Atualize a página.';
    }

    if (status === 400) {
      return (error as { error?: { detail?: string } })?.error?.detail
        ? 'Dados inválidos para esta operação. Revise o motivo e as datas.'
        : 'Não foi possível concluir a operação.';
    }

    return 'Não foi possível atualizar a confirmação. Tente novamente.';
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }
}

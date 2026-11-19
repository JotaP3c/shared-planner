import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { CalendarService } from '../../core/api/calendar.service';
import { CatalogService } from '../../core/api/catalog.service';
import { canCalendarPermission } from '../../core/auth/calendar-permissions';
import { CatalogItemRequest, CatalogItemResponse, CatalogPriceHistory, CatalogType } from '../../core/models/catalog.models';
import { CalendarResponse } from '../../core/models/shared-planner.models';
import { SpBadge, SpButtonDirective, SpEmptyState, SpInputDirective, SpLoadingState, SpPageHeader, SpSelectDirective, SpTableDirective } from '../../shared/ui/design-system';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const priceValidators = [Validators.min(0), Validators.max(9999999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)];

@Component({
  selector: 'app-catalog-page',
  imports: [DatePipe, ReactiveFormsModule, SpBadge, SpButtonDirective, SpEmptyState, SpInputDirective,
    SpLoadingState, SpPageHeader, SpSelectDirective, SpTableDirective],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly calendarApi = inject(CalendarService);
  private readonly api = inject(CatalogService);
  private readonly fb = inject(FormBuilder);
  private listRequest?: Subscription;
  private historyRequest?: Subscription;

  readonly calendars = signal<CalendarResponse[]>([]);
  readonly calendarId = signal('');
  readonly selectedCalendar = computed(() => this.calendars().find(calendar => calendar.id === this.calendarId()));
  readonly canManage = computed(() => canCalendarPermission(this.selectedCalendar(), 'CATALOG_MANAGE'));
  readonly items = signal<CatalogItemResponse[]>([]);
  readonly page = signal(0);
  readonly pageSize = 30;
  readonly total = signal(0);
  readonly loadingCalendars = signal(false);
  readonly loadingItems = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly success = signal('');
  readonly formOpen = signal(false);
  readonly filtersCollapsed = signal(false);
  readonly editing = signal<CatalogItemResponse | null>(null);
  readonly historyItem = signal<CatalogItemResponse | null>(null);
  readonly loadingHistory = signal(false);
  readonly historyError = signal('');
  readonly history = signal<CatalogPriceHistory[]>([]);
  readonly historyPage = signal(0);
  readonly historyPageSize = 20;
  readonly hasMoreHistory = computed(() => this.history().length === this.historyPageSize);
  readonly currency = (amount: number) => money.format(amount);
  readonly displayDate = (date: string | null) => date?.split('-').reverse().join('/') ?? '';

  readonly filters = this.fb.nonNullable.group({
    q: '', category: '', type: this.fb.nonNullable.control<CatalogType | ''>(''),
    status: this.fb.nonNullable.control<'active' | 'inactive' | 'all'>('active'),
  });
  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(180)]),
    type: this.fb.nonNullable.control<CatalogType>('SERVICE'),
    code: this.fb.nonNullable.control('', Validators.maxLength(60)),
    description: this.fb.nonNullable.control('', Validators.maxLength(2000)),
    category: this.fb.nonNullable.control('', Validators.maxLength(100)),
    standardPrice: this.fb.control<number | null>(null, [Validators.required, ...priceValidators]),
    promotionalPrice: this.fb.control<number | null>(null, priceValidators),
    promotionStartDate: this.fb.nonNullable.control(''),
    promotionEndDate: this.fb.nonNullable.control(''),
    durationMinutes: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(1440), Validators.pattern(/^\d+$/)]),
  });

  constructor() {
    afterNextRender(() => {
      if (typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches) {
        this.filtersCollapsed.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.refreshCalendars();
  }

  refreshCalendars(): void {
    if (this.loadingCalendars()) return;
    this.loadingCalendars.set(true);
    this.error.set('');
    this.calendarApi.list().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCalendars.set(false))).subscribe({
      next: calendars => {
        const allowed = calendars.filter(calendar => canCalendarPermission(calendar, 'CATALOG_VIEW')
          && canCalendarPermission(calendar, 'FINANCE_VIEW'));
        this.calendars.set(allowed);
        this.selectCalendar(allowed.some(calendar => calendar.id === this.calendarId()) ? this.calendarId() : allowed[0]?.id ?? '');
      },
      error: () => this.error.set('Não foi possível consultar seus calendários. Tente novamente.'),
    });
  }

  selectCalendar(id: string): void {
    if (this.saving() || (id && !this.calendars().some(calendar => calendar.id === id))) return;
    this.calendarId.set(id);
    this.cancelForm();
    this.closeHistory();
    this.success.set('');
    this.load();
  }

  load(page = 0): void {
    this.listRequest?.unsubscribe();
    this.items.set([]);
    this.total.set(0);
    this.error.set('');
    const calendarId = this.calendarId();
    this.page.set(page);
    if (!calendarId) return;
    const { q, type, category, status } = this.filters.getRawValue();
    this.loadingItems.set(true);
    this.listRequest = this.api.list(calendarId, {
      q: q.trim(), type: type || undefined, category: category.trim(),
      active: status === 'all' ? undefined : status === 'active', page, size: this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingItems.set(false))).subscribe({
      next: response => {
        this.items.set(response.items);
        this.total.set(response.totalElements);
      },
      error: error => this.error.set(error.status === 403 || error.status === 404
        ? 'Você não tem acesso ao catálogo deste calendário.' : 'Não foi possível carregar o catálogo.'),
    });
  }

  openForm(item: CatalogItemResponse | null = null): void {
    if (!this.canManage() || this.saving() || (item && item.calendarId !== this.calendarId())) return;
    this.closeHistory();
    this.success.set('');
    this.formError.set('');
    this.editing.set(item);
    this.form.reset({
      name: item?.name ?? '', type: item?.type ?? 'SERVICE', code: item?.code ?? '',
      description: item?.description ?? '', category: item?.category ?? '',
      durationMinutes: item?.durationMinutes ?? null, standardPrice: item?.standardPrice ?? null,
      promotionalPrice: item?.promotionalPrice ?? null, promotionStartDate: item?.promotionStartDate ?? '',
      promotionEndDate: item?.promotionEndDate ?? '',
    });
    this.formOpen.set(true);
  }

  cancelForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.editing.set(null);
    this.formError.set('');
  }

  save(): void {
    if (!this.formOpen() || !this.canManage() || this.saving()) return;
    const fields = this.form.getRawValue();
    const name = fields.name.trim();
    if (this.form.invalid || !name || fields.standardPrice === null) {
      this.form.markAllAsTouched();
      this.formError.set('Confira o nome, os preços e a duração. Use até duas casas decimais para preços.');
      return;
    }
    const hasPromotion = fields.promotionalPrice !== null;
    if (hasPromotion ? !fields.promotionStartDate || !fields.promotionEndDate
      || fields.promotionEndDate < fields.promotionStartDate || fields.promotionalPrice! >= fields.standardPrice
      : !!fields.promotionStartDate || !!fields.promotionEndDate) {
      this.formError.set('Informe um preço promocional menor que o padrão e um período válido, ou limpe os três campos.');
      return;
    }
    const editing = this.editing();
    const request: CatalogItemRequest = {
      ...fields, name, standardPrice: fields.standardPrice, active: editing?.active ?? true,
      version: editing?.version, code: fields.code.trim() || null, description: fields.description.trim() || null,
      category: fields.category.trim() || null, promotionStartDate: fields.promotionStartDate || null,
      promotionEndDate: fields.promotionEndDate || null,
    };
    this.mutate(request, editing?.id, editing ? 'Item atualizado.' : 'Item cadastrado.');
  }

  toggleActive(item: CatalogItemResponse): void {
    if (!this.canManage() || this.saving() || item.calendarId !== this.calendarId()) return;
    const { id, calendarId, effectivePrice, promotionApplied, ...fields } = item;
    this.mutate({ ...fields, active: !item.active }, id, item.active ? 'Item desativado.' : 'Item reativado.');
  }

  private mutate(request: CatalogItemRequest, itemId: string | undefined, message: string): void {
    this.saving.set(true);
    this.error.set('');
    this.formError.set('');
    this.success.set('');
    const calendarId = this.calendarId();
    const operation = itemId ? this.api.update(calendarId, itemId, request) : this.api.create(calendarId, request);
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.formOpen.set(false);
        this.editing.set(null);
        this.closeHistory();
        this.success.set(message);
        this.load();
      },
      error: error => {
        const message = error.status === 409 ? 'O item mudou. Atualize a lista antes de tentar novamente.'
          : error.status === 403 || error.status === 404 ? 'Você não tem permissão para alterar este item.'
            : error.status === 400 ? 'O catálogo rejeitou os dados. Confira os campos informados.' : 'Não foi possível salvar o item. Tente novamente.';
        (this.formOpen() ? this.formError : this.error).set(message);
      },
    });
  }

  openHistory(item: CatalogItemResponse, page = 0): void {
    if (item.calendarId !== this.calendarId()) return;
    this.closeHistory();
    this.historyItem.set(item);
    this.historyPage.set(page);
    this.loadingHistory.set(true);
    this.historyRequest = this.api.priceHistory(this.calendarId(), item.id, page, this.historyPageSize)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingHistory.set(false))).subscribe({
        next: history => this.history.set(history),
        error: () => this.historyError.set('Não foi possível carregar o histórico de preços.'),
      });
  }

  closeHistory(): void {
    this.historyRequest?.unsubscribe();
    this.historyItem.set(null);
    this.history.set([]);
    this.historyError.set('');
  }
}

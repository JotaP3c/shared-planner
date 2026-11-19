import { computed, signal } from '@angular/core';
import { Subscription, switchMap, timer } from 'rxjs';
import { CatalogService } from '../../../core/api/catalog.service';
import { EventService } from '../../../core/api/event.service';
import { CatalogItemResponse } from '../../../core/models/catalog.models';
import { EventCatalogItem, EventCatalogSelection, EventResponse } from '../../../core/models/shared-planner.models';

interface DraftLine extends EventCatalogItem {
  currentQuote: boolean;
}

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amount: number) => amount / 100;
const MAX_CENTS = 999_999_999_999;

/** Owns the temporary catalog selection. The API remains authoritative on save. */
export class EventCatalogDraft {
  static readonly maxQuantity = 999;
  static readonly maxLines = 50;
  private searchRequest?: Subscription;
  private quoteRequest?: Subscription;
  private original: DraftLine[] = [];
  private calendarId = '';
  private date = '';

  readonly lines = signal<DraftLine[]>([]);
  readonly term = signal('');
  readonly matches = signal<CatalogItemResponse[]>([]);
  readonly searchOpen = signal(false);
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  readonly activeIndex = signal(-1);
  readonly quoteLoading = signal(false);
  readonly quoteError = signal('');
  readonly reprice = signal(false);
  readonly manual = signal(false);
  readonly amountCents = computed(() => this.lines().reduce((total, line) => total + toCents(line.subtotal), 0));
  readonly amount = computed(() => fromCents(this.amountCents()));
  readonly exceedsLimit = computed(() => this.amountCents() > MAX_CENTS);
  readonly duration = computed(() => this.lines().reduce((total, line) =>
    total + (line.durationMinutes ?? 0) * line.quantity, 0));

  constructor(
    private readonly catalog: CatalogService,
    private readonly events: EventService,
    private readonly onRefreshed: () => void,
  ) {}

  reset(calendarId: string, date: string, event?: EventResponse): void {
    this.dispose();
    this.calendarId = calendarId;
    this.date = date;
    this.original = (event?.catalogItems ?? []).map(line => ({ ...line, currentQuote: false }));
    this.lines.set(this.original);
    this.clearSearch();
    this.quoteLoading.set(false);
    this.quoteError.set('');
    this.reprice.set(false);
    this.manual.set(!!event && !this.original.length);
  }

  dispose(): void {
    this.searchRequest?.unsubscribe();
    this.quoteRequest?.unsubscribe();
  }

  clearSearch(): void {
    this.searchRequest?.unsubscribe();
    this.matches.set([]);
    this.term.set('');
    this.searchOpen.set(false);
    this.searchLoading.set(false);
    this.searchError.set('');
    this.activeIndex.set(-1);
  }

  search(term: string): void {
    this.searchRequest?.unsubscribe();
    this.term.set(term);
    this.matches.set([]);
    this.activeIndex.set(-1);
    this.searchError.set('');
    const q = term.trim();
    const canSearch = !!(this.calendarId && this.date && q);
    this.searchOpen.set(canSearch);
    this.searchLoading.set(canSearch);
    if (!canSearch) return;
    this.searchRequest = timer(220).pipe(switchMap(() =>
      this.catalog.list(this.calendarId, { q, active: true, appointmentDate: this.date, page: 0, size: 15 })
    )).subscribe({
      next: page => {
        this.matches.set(page.items);
        this.searchLoading.set(false);
      },
      error: () => {
        this.searchError.set('Não foi possível consultar o catálogo. Tente novamente.');
        this.searchLoading.set(false);
      },
    });
  }

  changeDate(date: string): void {
    if (date === this.date) return;
    this.date = date;
    this.clearSearch();
    if (this.lines().some(line => line.currentQuote)) this.refresh();
  }

  select(item: CatalogItemResponse): boolean {
    if (item.calendarId !== this.calendarId || !item.active || !this.matches().some(match => match.id === item.id)) return false;
    const existing = this.lines().find(line => line.catalogItemId === item.id);
    const historical = !this.reprice() && this.original.find(line => line.catalogItemId === item.id);
    if (existing) {
      if (existing.quantity >= EventCatalogDraft.maxQuantity) return false;
      this.setQuantity(existing.catalogItemId, existing.quantity + 1);
    } else {
      if (this.lines().length >= EventCatalogDraft.maxLines) return false;
      const newLine: DraftLine = historical ? this.withQuantity(historical, 1) : {
        catalogItemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.effectivePrice,
        subtotal: item.effectivePrice,
        discount: fromCents(toCents(item.standardPrice) - toCents(item.effectivePrice)),
        durationMinutes: item.durationMinutes ?? null,
        currentQuote: true,
      };
      this.lines.update(lines => [...lines, newLine]);
    }
    this.manual.set(false);
    this.clearSearch();
    return true;
  }

  setQuantity(id: string, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > EventCatalogDraft.maxQuantity) return;
    this.lines.update(lines => lines.map(line => line.catalogItemId === id ? this.withQuantity(line, quantity) : line));
  }

  remove(id: string): void {
    this.lines.update(lines => lines.filter(line => line.catalogItemId !== id));
    if (!this.lines().some(line => line.currentQuote)) {
      this.quoteRequest?.unsubscribe();
      this.quoteLoading.set(false);
      this.quoteError.set('');
    }
  }

  repriceAll(): void {
    if (!this.lines().length) return;
    this.reprice.set(true);
    this.lines.update(lines => lines.map(line => ({ ...line, currentQuote: true })));
    this.refresh();
  }

  restoreOriginal(): void {
    this.quoteRequest?.unsubscribe();
    this.quoteLoading.set(false);
    this.quoteError.set('');
    this.reprice.set(false);
    this.lines.set(this.original);
    this.clearSearch();
  }

  refresh(): void {
    this.quoteRequest?.unsubscribe();
    this.quoteError.set('');
    this.quoteLoading.set(false);
    const toRefresh = this.lines().filter(line => line.currentQuote);
    if (!toRefresh.length) return;
    if (!this.date) {
      this.quoteError.set('Informe a data do atendimento para consultar os preços.');
      return;
    }
    this.quoteLoading.set(true);
    this.quoteRequest = this.events.catalogQuote(this.calendarId, this.date, toRefresh.map(line => ({
      catalogItemId: line.catalogItemId, quantity: line.quantity,
    }))).subscribe({
      next: quote => {
        const byId = new Map(quote.catalogItems.map(line => [line.catalogItemId, line]));
        if (toRefresh.some(line => !byId.has(line.catalogItemId))) {
          this.quoteError.set('A consulta não retornou todos os itens. Revise a seleção.');
        } else {
          this.lines.update(lines => lines.map(line => {
            const updated = byId.get(line.catalogItemId);
            return updated && line.currentQuote ? this.withQuantity({ ...updated, currentQuote: true }, line.quantity) : line;
          }));
          this.onRefreshed();
        }
        this.quoteLoading.set(false);
      },
      error: () => {
        this.quoteError.set('Não foi possível consultar os preços atuais. Verifique se os itens ainda estão ativos.');
        this.quoteLoading.set(false);
      },
    });
  }

  markStale(): void {
    this.quoteError.set('O catálogo mudou. Consulte os preços atuais e confira o total antes de salvar.');
  }

  changed(): boolean {
    const lines = this.lines();
    return this.reprice() || lines.length !== this.original.length || lines.some(line =>
      !this.original.some(original => original.catalogItemId === line.catalogItemId && original.quantity === line.quantity));
  }

  payload(): EventCatalogSelection[] {
    return this.lines().map(line => ({
      catalogItemId: line.catalogItemId,
      quantity: line.quantity,
      expectedUnitPrice: line.unitPrice,
      expectedDiscount: line.discount,
      expectedDurationMinutes: line.durationMinutes ?? 0,
    }));
  }

  hasOriginal(): boolean {
    return this.original.length > 0;
  }

  private withQuantity(line: DraftLine, quantity: number): DraftLine {
    const unitDiscount = Math.round(toCents(line.discount) / line.quantity);
    return { ...line, quantity, discount: fromCents(unitDiscount * quantity), subtotal: fromCents(toCents(line.unitPrice) * quantity) };
  }
}

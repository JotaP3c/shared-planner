import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** Classe de cor (tokens em _charts.scss): paid, partial, pending, refunded, confirmed... */
  tone: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Gráfico de rosca em SVG, sem dependência externa. Recebe categorias mutuamente
 * exclusivas de UMA mesma unidade (quantidade ou valor — nunca misturadas).
 * Acessível: role="img" com resumo textual e legenda com valores e percentuais.
 */
@Component({
  selector: 'sp-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="sp-donut">
        <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="ariaSummary()" focusable="false">
          <g transform="rotate(-90 60 60)">
            <circle class="sp-donut-track" cx="60" cy="60" [attr.r]="radius" />
            @for (segment of segments(); track segment.key) {
              @if (segment.value > 0) {
                <circle
                  [class]="'sp-donut-segment tone-' + segment.tone"
                  [attr.data-testid]="'donut-segment-' + segment.key"
                  cx="60"
                  cy="60"
                  [attr.r]="radius"
                  [attr.stroke-dasharray]="segment.dash + ' ' + (circumference - segment.dash)"
                  [attr.stroke-dashoffset]="-segment.offset"
                >
                  <title>{{ segment.label }}: {{ segment.value }} ({{ segment.percentLabel }})</title>
                </circle>
              }
            }
          </g>
          <text class="sp-donut-total" x="60" y="58" text-anchor="middle">{{ total() }}</text>
          <text class="sp-donut-caption" x="60" y="74" text-anchor="middle">{{ centerLabel() }}</text>
        </svg>

        <ul class="sp-chart-legend">
          @for (segment of segments(); track segment.key) {
            <li [attr.data-testid]="'donut-legend-' + segment.key">
              <i [class]="'sp-swatch tone-' + segment.tone" aria-hidden="true"></i>
              <span class="legend-label">{{ segment.label }}</span>
              <strong>{{ segment.value }}</strong>
              <small>{{ segment.percentLabel }}</small>
            </li>
          }
        </ul>
      </div>
    } @else {
      <p class="sp-chart-empty" role="status">{{ emptyMessage() }}</p>
    }
  `,
})
export class DonutChart {
  readonly slices = input.required<DonutSlice[]>();
  readonly centerLabel = input('total');
  readonly label = input('Distribuição');
  readonly emptyMessage = input('Sem dados no período.');

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;

  readonly total = computed(() =>
    this.slices().reduce((sum, slice) => sum + Math.max(0, slice.value || 0), 0),
  );

  readonly segments = computed(() => {
    const total = this.total();
    let offset = 0;

    return this.slices().map(slice => {
      const value = Math.max(0, slice.value || 0);
      const ratio = total > 0 ? value / total : 0;
      const dash = ratio * CIRCUMFERENCE;
      const segment = {
        ...slice,
        value,
        dash,
        offset,
        percentLabel: `${(ratio * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
      };
      offset += dash;
      return segment;
    });
  });

  readonly ariaSummary = computed(() =>
    `${this.label()}: ` + this.segments()
      .map(segment => `${segment.label} ${segment.value} (${segment.percentLabel})`)
      .join(', '),
  );
}

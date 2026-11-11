import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarChartPoint {
  label: string;
  /** Série principal (ex.: receita prevista). */
  primary: number;
  /** Série secundária (ex.: receita recebida). */
  secondary: number;
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 8;

/**
 * Barras agrupadas em SVG para a evolução financeira (valores reais por dia/mês).
 * Cada barra tem <title> com o valor formatado; a tabela oculta descreve os dados para
 * leitores de tela.
 */
@Component({
  selector: 'sp-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasValues()) {
      <figure class="sp-bar-chart">
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img"
             [attr.aria-label]="label()" focusable="false">
          @for (line of gridLines(); track line) {
            <line class="sp-bar-grid" [attr.x1]="0" [attr.x2]="width" [attr.y1]="line" [attr.y2]="line" />
          }
          @for (bar of bars(); track bar.index) {
            <rect class="sp-bar primary" [attr.x]="bar.x" [attr.y]="bar.primaryY" [attr.width]="bar.width"
                  [attr.height]="bar.primaryHeight" rx="2">
              <title>{{ bar.label }} · {{ primaryLabel() }}: {{ format()(bar.primary) }}</title>
            </rect>
            <rect class="sp-bar secondary" [attr.x]="bar.x + bar.width" [attr.y]="bar.secondaryY"
                  [attr.width]="bar.width" [attr.height]="bar.secondaryHeight" rx="2">
              <title>{{ bar.label }} · {{ secondaryLabel() }}: {{ format()(bar.secondary) }}</title>
            </rect>
            @if (bar.showLabel) {
              <text class="sp-bar-axis" [attr.x]="bar.x + bar.width" [attr.y]="height - 8" text-anchor="middle">
                {{ bar.label }}
              </text>
            }
          }
        </svg>
        <figcaption class="sp-chart-legend inline">
          <span><i class="sp-swatch tone-expected" aria-hidden="true"></i>{{ primaryLabel() }}</span>
          <span><i class="sp-swatch tone-received" aria-hidden="true"></i>{{ secondaryLabel() }}</span>
          <span class="max">Máximo: {{ format()(maxValue()) }}</span>
        </figcaption>
        <table class="sr-only">
          <caption>{{ label() }}</caption>
          <thead><tr><th>Período</th><th>{{ primaryLabel() }}</th><th>{{ secondaryLabel() }}</th></tr></thead>
          <tbody>
            @for (point of points(); track $index) {
              <tr><td>{{ point.label }}</td><td>{{ format()(point.primary) }}</td><td>{{ format()(point.secondary) }}</td></tr>
            }
          </tbody>
        </table>
      </figure>
    } @else {
      <p class="sp-chart-empty" role="status">{{ emptyMessage() }}</p>
    }
  `,
})
export class BarChart {
  readonly points = input.required<BarChartPoint[]>();
  readonly label = input('Evolução');
  readonly primaryLabel = input('Prevista');
  readonly secondaryLabel = input('Recebida');
  readonly emptyMessage = input('Sem valores no período.');
  readonly format = input<(value: number) => string>(value => String(value));

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  readonly maxValue = computed(() =>
    this.points().reduce((max, point) => Math.max(max, point.primary || 0, point.secondary || 0), 0),
  );

  readonly hasValues = computed(() => this.maxValue() > 0);

  readonly gridLines = computed(() => {
    const usable = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    return [0, 0.25, 0.5, 0.75, 1].map(ratio => PADDING_TOP + usable * ratio);
  });

  readonly bars = computed(() => {
    const points = this.points();
    const max = this.maxValue() || 1;
    const usable = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const slot = (WIDTH - PADDING_LEFT * 2) / Math.max(points.length, 1);
    const barWidth = Math.max(1, slot * 0.36);
    const labelEvery = Math.max(1, Math.ceil(points.length / 10));

    return points.map((point, index) => {
      const primaryHeight = (Math.max(0, point.primary) / max) * usable;
      const secondaryHeight = (Math.max(0, point.secondary) / max) * usable;
      return {
        index,
        label: point.label,
        primary: point.primary,
        secondary: point.secondary,
        x: PADDING_LEFT + slot * index + (slot - barWidth * 2) / 2,
        width: barWidth,
        primaryHeight,
        secondaryHeight,
        primaryY: PADDING_TOP + usable - primaryHeight,
        secondaryY: PADDING_TOP + usable - secondaryHeight,
        showLabel: index % labelEvery === 0,
      };
    });
  });
}

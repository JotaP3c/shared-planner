import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'calendar' | 'calendar-plus' | 'calendar-check' | 'users' | 'user' | 'user-plus' | 'shield'
  | 'settings' | 'wallet' | 'chart' | 'trend-up' | 'trend-down' | 'chevron-down' | 'chevron-left'
  | 'chevron-right' | 'search' | 'bell' | 'plus' | 'x' | 'sun' | 'moon' | 'monitor' | 'logout'
  | 'clock' | 'check' | 'briefcase' | 'filter-x' | 'eye' | 'eye-off' | 'mail' | 'lock' | 'list'
  | 'menu' | 'edit' | 'trash' | 'credit-card' | 'refresh' | 'alert' | 'inbox' | 'arrow-right'
  | 'heart' | 'layers';

/**
 * Ícones em SVG inline (traço 1.8, 24x24) sem dependência externa.
 * Decorativos por padrão (aria-hidden); passe `label` quando o ícone for o único conteúdo.
 */
@Component({
  selector: 'sp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sp-icon',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
  },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" focusable="false">
      @switch (name()) {
        @case ('calendar') {
          <rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        }
        @case ('calendar-plus') {
          <rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5" />
        }
        @case ('calendar-check') {
          <rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.8 15l2.2 2.2 4.2-4.4" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
          <path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
        }
        @case ('user') { <circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6.2 8-6.2s7.2 2.2 8 6.2" /> }
        @case ('user-plus') {
          <circle cx="10" cy="8" r="4" /><path d="M2.5 21c.8-4 3.8-6.2 7.5-6.2 1.4 0 2.7.3 3.8.9M19 14v6M16 17h6" />
        }
        @case ('shield') { <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /> }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        }
        @case ('wallet') {
          <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 18.5 7H5.5" />
          <circle cx="16.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        }
        @case ('chart') { <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /> }
        @case ('trend-up') { <path d="m3 17 6-6 4 4 8-8M15 7h6v6" /> }
        @case ('trend-down') { <path d="m3 7 6 6 4-4 8 8M15 17h6v-6" /> }
        @case ('chevron-down') { <path d="m6 9 6 6 6-6" /> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6" /> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6" /> }
        @case ('search') { <circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.5-4.5" /> }
        @case ('bell') { <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        }
        @case ('moon') { <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.6 6.6 0 0 0 11 11z" /> }
        @case ('monitor') { <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /> }
        @case ('logout') { <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /> }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
        @case ('check') { <path d="M20 6 9 17l-5-5" /> }
        @case ('briefcase') {
          <rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18" />
        }
        @case ('filter-x') { <path d="M3 4h18l-7 8.5V19l-4 2v-8.5zM16 3l5 5M21 3l-5 5" /> }
        @case ('eye') { <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /> }
        @case ('eye-off') {
          <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
        }
        @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /> }
        @case ('lock') { <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /> }
        @case ('list') { <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /> }
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16" /> }
        @case ('edit') { <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> }
        @case ('trash') { <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /> }
        @case ('credit-card') { <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /> }
        @case ('refresh') { <path d="M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4" /> }
        @case ('alert') { <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /> }
        @case ('inbox') { <path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /> }
        @case ('arrow-right') { <path d="M5 12h14M13 6l6 6-6 6" /> }
        @case ('heart') { <path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z" /> }
        @case ('layers') { <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" /> }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; flex: 0 0 auto; line-height: 0; }
    svg { width: 100%; height: 100%; }
  `],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input('');
}

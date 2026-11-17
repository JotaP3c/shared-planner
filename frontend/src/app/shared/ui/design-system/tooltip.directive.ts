import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, PLATFORM_ID, Renderer2, effect, inject, input } from '@angular/core';

let tooltipSequence = 0;

/** Supplemental text only. The trigger still needs its own accessible name. */
@Directive({
  selector: '[spTooltip]',
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '(focusin)': 'onFocus()',
    '(focusout)': 'onBlur()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class SpTooltip {
  readonly spTooltip = input('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly id = `sp-tooltip-${++tooltipSequence}`;
  private tooltip: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private hovered = false;
  private focused = false;
  private tooltipHovered = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    effect(() => {
      const text = this.spTooltip();
      if (!text.trim()) this.dismiss();
      else if (this.tooltip) {
        this.renderer.setProperty(this.tooltip, 'textContent', text);
        this.position();
      }
    });
    inject(DestroyRef).onDestroy(() => this.dismiss());
  }

  onMouseEnter(): void { this.hovered = true; this.show(); }
  onMouseLeave(): void { this.hovered = false; this.scheduleHide(); }
  onFocus(): void { this.focused = true; this.show(); }
  onBlur(): void { this.focused = false; this.scheduleHide(); }

  onEscape(event: Event): void {
    if (!this.tooltip) return;
    event.preventDefault();
    event.stopPropagation();
    this.dismiss();
  }

  dismiss(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    if (this.tooltip && this.container) this.renderer.removeChild(this.container, this.tooltip);
    this.tooltip = null;
    this.container = null;
    this.tooltipHovered = false;
    const remaining = (this.host.nativeElement.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== this.id);
    if (remaining.length) this.renderer.setAttribute(this.host.nativeElement, 'aria-describedby', remaining.join(' '));
    else this.renderer.removeAttribute(this.host.nativeElement, 'aria-describedby');
  }

  private show(): void {
    if (!this.isBrowser || !this.spTooltip().trim() || this.host.nativeElement.matches(':disabled')) return;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    if (this.tooltip) return;
    const tooltip = this.renderer.createElement('span') as HTMLElement;
    this.renderer.setAttribute(tooltip, 'id', this.id);
    this.renderer.setAttribute(tooltip, 'role', 'tooltip');
    this.renderer.addClass(tooltip, 'sp-ds-tooltip');
    this.renderer.setProperty(tooltip, 'textContent', this.spTooltip());
    // A dialog's top layer also makes body siblings inert; keep its tooltips inside it.
    this.container = this.host.nativeElement.closest<HTMLElement>('dialog[open]') ?? this.document.body;
    this.renderer.appendChild(this.container, tooltip);
    this.tooltip = tooltip;
    const ids = (this.host.nativeElement.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    this.renderer.setAttribute(this.host.nativeElement, 'aria-describedby', [...ids, this.id].join(' '));
    this.listeners.push(
      this.renderer.listen(tooltip, 'mouseenter', () => { this.tooltipHovered = true; }),
      this.renderer.listen(tooltip, 'mouseleave', () => { this.tooltipHovered = false; this.scheduleHide(); }),
      this.renderer.listen('window', 'resize', () => this.position()),
      this.renderer.listen('document', 'scroll', () => this.position(), { capture: true }),
    );
    this.position();
  }

  private scheduleHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.hovered && !this.focused && !this.tooltipHovered) this.dismiss();
    }, 125);
  }

  private position(): void {
    if (!this.tooltip) return;
    const trigger = this.host.nativeElement.getBoundingClientRect();
    const tooltip = this.tooltip.getBoundingClientRect();
    const viewport = this.document.defaultView;
    const width = viewport?.innerWidth ?? this.document.documentElement.clientWidth;
    const height = viewport?.innerHeight ?? this.document.documentElement.clientHeight;
    const left = Math.max(8, Math.min(trigger.left + (trigger.width - tooltip.width) / 2, width - tooltip.width - 8));
    const below = trigger.bottom + 8;
    const top = below + tooltip.height <= height - 8 ? below : Math.max(8, trigger.top - tooltip.height - 8);
    this.renderer.setStyle(this.tooltip, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltip, 'top', `${top}px`);
  }
}

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DESIGN_SYSTEM_ROUTES } from './design-system.routes.dev';

describe('development design system route', () => {
  it('opens the showcase without authentication or business API calls', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(DESIGN_SYSTEM_ROUTES)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/design-system');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Design System');
    expect(TestBed.inject(Router).url).toBe('/design-system');
    // index.html has <base href="/">: bare #fragments would leave the catalog.
    const links = harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('.ds-skip, .ds-nav a');
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) {
      const target = new URL(link.getAttribute('href')!, 'http://localhost/');
      expect(target.pathname).toBe('/design-system');
      expect(target.hash.length).toBeGreaterThan(1);
    }
  });
});

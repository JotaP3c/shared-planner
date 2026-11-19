/* Render and interaction QA with synthetic, intercepted HTTP only.
 * PLANNER_BROWSER_BUILD_DIR: Angular browser output (immutable baseline allowed).
 * PLANNER_QA_OUTPUT: private screenshot/report directory.
 * PLANNER_PLAYWRIGHT_MODULE: existing external Playwright installation.
 * --before captures the previous UI without requiring the new design system.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLANNER_PLAYWRIGHT_MODULE || 'playwright');
const { fixtures, user, calendars, adminCalendarPermissions } = require('./browser-smoke.cjs');
const before = process.argv.includes('--before');
const root = path.resolve(process.env.PLANNER_BROWSER_BUILD_DIR || path.resolve(__dirname, '../dist/shared-planner-frontend/browser'));
const output = path.resolve(process.env.PLANNER_QA_OUTPUT || path.join(os.tmpdir(), 'shared-planner-professional-ui'));
fs.mkdirSync(output, { recursive: true });
const actor = { ...user, role: 'ADMIN', permissions: [...new Set([...user.permissions, ...adminCalendarPermissions,
  'USERS_VIEW', 'USERS_MANAGE', 'ROLES_MANAGE', 'AUDIT_VIEW_ALL', 'CATALOG_VIEW', 'CATALOG_MANAGE'])] };
const catalogItems = [
  { id: 'qa-service', calendarId: 'personal-a', type: 'SERVICE', name: 'Procedimento de teste',
    category: 'Consultas', standardPrice: 50, promotionalPrice: null, effectivePrice: 50,
    durationMinutes: 30, active: true, version: 0 },
  { id: 'qa-product', calendarId: 'personal-a', type: 'PRODUCT', name: 'Produto de teste',
    category: 'Produtos', standardPrice: 12.5, promotionalPrice: null, effectivePrice: 12.5,
    durationMinutes: null, active: true, version: 0 },
];
const member = { id: 'member-other', userId: 'other-user', calendarId: 'personal-a', userFullName: 'Marina de teste',
  userEmail: 'other@example.invalid', role: 'EDITOR', roles: ['EDITOR', 'FINANCE'], createdAt: '2026-11-01T10:00:00' };
const users = [actor, { id: 'other-user', fullName: member.userFullName, email: member.userEmail, role: 'FINANCE', active: true,
  createdAt: '2026-10-01T10:00:00', updatedAt: '2026-11-01T10:00:00' },
  { id: 'inactive-user', fullName: 'Conta inativa de teste', email: 'inactive@example.invalid', role: 'USER', active: false }];
const baseEvent = { calendarId: 'personal-a', createdByEmail: actor.email, approvalRequestedFromEmail: null, approvedByEmail: null,
  clientName: null, personName: null, description: 'Registro sintético usado somente na verificação visual.', workDescription: null,
  startsAt: '2026-11-17T09:00:00', endsAt: '2026-11-17T10:00:00', status: 'APPROVED' };
const events = [
  { ...baseEvent, id: 'qa-client', title: 'Atendimento de teste', eventType: 'CLIENT', clientName: 'Cliente de teste',
    workDescription: 'Consulta de demonstração', clientPhone: '11912345678', amount: 100, receivedAmount: 40,
    paymentStatus: 'PARTIALLY_PAID', paymentMethod: 'PIX', confirmationStatus: 'CONFIRMED' },
  { ...baseEvent, id: 'qa-personal', title: 'Compromisso pessoal', eventType: 'PERSONAL', personName: 'Conta de teste',
    startsAt: '2026-11-18T14:00:00', endsAt: '2026-11-18T15:00:00' },
  { ...baseEvent, id: 'qa-shared', title: 'Planejamento compartilhado', eventType: 'SHARED', calendarId: 'shared',
    createdByEmail: member.userEmail, approvalRequestedFromEmail: actor.email, status: 'PENDING_APPROVAL',
    startsAt: '2026-11-19T10:00:00', endsAt: '2026-11-19T11:00:00' },
  { ...baseEvent, id: 'qa-all-day', title: 'Compromisso de dia inteiro', eventType: 'PERSONAL', calendarId: 'personal-b',
    allDay: true, startsAt: '2026-11-20T00:00:00', endsAt: '2026-11-21T00:00:00' },
];
const pending = events.filter(event => event.status === 'PENDING_APPROVAL');
const profiles = [
  { id: 'viewer-profile', code: 'CUSTOM_VIEW', name: 'Consulta de calendário', scope: 'CALENDAR', active: true, builtIn: false, permissions: ['CALENDAR_VIEW'] },
  { id: 'finance-profile', code: 'CUSTOM_FINANCE', name: 'Gestão financeira', scope: 'CALENDAR', active: true, builtIn: false,
    permissions: ['CALENDAR_VIEW', 'FINANCE_VIEW', 'FINANCE_MANAGE', 'FINANCE_EXPORT'] },
];
const audit = [{ id: 'audit-1', entityType: 'EVENT', entityId: 'qa-client', calendarId: 'personal-a', action: 'CREATED',
  summary: 'Atendimento de teste criado.', performedByEmail: actor.email, performedAt: '2026-11-17T08:00:00', oldValue: null, newValue: null },
  { id: 'audit-2', entityType: 'CALENDAR_MEMBER', entityId: member.id, calendarId: 'personal-a', action: 'UPDATED',
    summary: 'Permissões do membro atualizadas.', performedByEmail: actor.email, performedAt: '2026-11-16T16:00:00', oldValue: null, newValue: null }];
const report = { mode: before ? 'before' : 'after', build: root, output, fixturesOnly: true, startedAt: new Date().toISOString(),
  screenshots: [], checks: [], failures: [], consoleErrors: [], externalRequests: [], interceptedRequests: [], contrast: [], fonts: [] };
function persist() { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
function check(name, condition, details) {
  report.checks.push({ name, passed: !!condition, ...(details ? { details } : {}) });
  if (!condition) report.failures.push(name);
  persist();
}
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (requested !== root && !requested.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  let file = requested;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(root, fs.existsSync(path.join(root, 'index.csr.html')) ? 'index.csr.html' : 'index.html');
  }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

async function installFixtures(context, state) {
  // The reusable fallback also fulfills every API request; no route.continue is used for APIs.
  await fixtures(context, actor);
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    report.interceptedRequests.push({ method: route.request().method(), path: url.pathname });
    let body;
    if (url.pathname === '/api/users') {
      if (state.users === 'loading') await new Promise(resolve => { state.releaseUsers = resolve; });
      if (state.users === 'error') { await route.fulfill({ status: 500, json: { message: 'Synthetic QA failure' } }); return; }
      body = state.users === 'empty' ? [] : users;
    } else if (url.pathname === '/api/access/users') body = users;
    else if (url.pathname === '/api/access/profiles') body = profiles;
    else if (url.pathname === '/api/access/assignments') body = { userId: url.searchParams.get('userId'),
      calendarId: url.searchParams.get('calendarId'), profileIds: ['viewer-profile'], explicit: true };
    else if (url.pathname === '/api/access/effective') body = { userId: actor.id, profileIds: [], globalPermissions: actor.permissions,
      calendars: calendars.map(calendar => ({ calendarId: calendar.id, profileIds: ['viewer-profile'], permissions: calendar.permissions })) };
    else if (url.pathname === '/api/calendars' && (state.catalogBooking || new URL(route.request().frame().url()).pathname === '/finance/catalog')) {
      body = calendars.map(calendar => calendar.id === 'personal-a'
        ? { ...calendar, permissions: [...calendar.permissions, 'CATALOG_VIEW', 'CATALOG_MANAGE'] } : calendar);
    } else if (/^\/api\/calendars\/[^/]+\/catalog$/.test(url.pathname)) {
      const query = (url.searchParams.get('q') || '').toLowerCase();
      const matching = catalogItems.filter(item => item.name.toLowerCase().includes(query));
      body = { items: matching, page: 0, size: 30, totalElements: matching.length };
    }
    else if (url.pathname.endsWith('/members')) body = [{ ...member, id: 'owner-member', userId: actor.id, userEmail: actor.email,
      userFullName: actor.fullName, role: 'ADMIN', roles: ['ADMIN'] }, member];
    else if (url.pathname === '/api/events/pending-approvals') body = state.pending === 'empty' ? [] : pending;
    else if (url.pathname === '/api/events') body = events.filter(event => !url.searchParams.get('calendarId') || event.calendarId === url.searchParams.get('calendarId'));
    else if (url.pathname === '/api/events/search') body = events.map(event => ({ ...event, calendarName: 'Calendário de teste A' }));
    else if (url.pathname.match(/^\/api\/events\/qa-[\w-]+$/)) body = events.find(event => event.id === url.pathname.split('/').at(-1));
    else if (url.pathname.endsWith('/confirmation-history') || url.pathname.endsWith('/approval-history')) body = [];
    else if (url.pathname === '/api/finance/appointments') body = [{ eventId: 'qa-client', calendarId: url.searchParams.get('calendarId'),
      startsAt: baseEvent.startsAt, clientName: 'Cliente de teste', workDescription: 'Consulta de demonstração', amount: 100,
      receivedAmount: 40, paymentStatus: 'PARTIALLY_PAID', confirmationStatus: 'CONFIRMED' }];
    else if (url.pathname === '/api/audit-logs') body = audit;
    else if (url.pathname === '/api/calendar-imports/preview') body = { source: 'GOOGLE_ICS', sourceCalendarId: 'qa-source',
      targetCalendarId: 'personal-a', imported: 0, duplicates: 1, blocked: 1, rows: [
        { uid: 'qa-new', title: 'Evento novo de teste', startsAt: baseEvent.startsAt, endsAt: baseEvent.endsAt, state: 'READY', reason: null },
        { uid: 'qa-duplicate', title: 'Evento já importado', startsAt: baseEvent.startsAt, endsAt: baseEvent.endsAt, state: 'DUPLICATE', reason: null },
        { uid: 'qa-blocked', title: 'Evento sem horário', startsAt: null, endsAt: null, state: 'BLOCKED', reason: 'Horário ausente' },
      ] };
    // Commits/imports are outside this render check, even against synthetic HTTP.
    else if (route.request().method() !== 'GET') { throw new Error(`Unexpected write during visual QA: ${url.pathname}`); }
    if (body === undefined) await route.fallback();
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  // Two paints allow Angular computed views and FullCalendar sizing to settle.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const filename = name + '.png';
  await page.screenshot({ path: path.join(output, filename), fullPage: false, animations: 'disabled' });
  report.screenshots.push(filename);
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - innerWidth,
    content: (() => { const main = document.querySelector('main.content'); return main ? main.scrollWidth - main.clientWidth : 0; })(),
  }));
  check(`${name}: no horizontal document overflow`, overflow.document <= 1, overflow);
  check(`${name}: no horizontal workspace overflow`, overflow.content <= 1, overflow);
  persist();
}

async function inspectContrast(page, name) {
  const results = await page.evaluate(() => {
    const rgb = text => { const values = text.match(/[\d.]+/g)?.map(Number); return values?.length >= 3 ? [...values.slice(0, 3), values[3] ?? 1] : null; };
    const blend = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3])).concat(1);
    const luminance = color => color.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; })
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const selectors = ['h1', '.page-header p', '.eyebrow', '.sp-field', '.login-subtitle', '.page-hint', '.pending-title-row h2',
      '.theme-option strong', '.account-list dt', '.profile-trigger', '.summary-card span', '.sp-badge', '.sp-pill'];
    const rows = [];
    for (const selector of selectors) for (const element of [...document.querySelectorAll(selector)].slice(0, 8)) {
      if (!element.getClientRects().length || !element.textContent.trim()) continue;
      const style = getComputedStyle(element);
      let bg = [255, 255, 255, 1];
      const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      for (const node of ancestors) { const color = rgb(getComputedStyle(node).backgroundColor); if (color) bg = blend(color, bg); }
      const fg = rgb(style.color); if (!fg) continue;
      const l1 = luminance(blend(fg, bg)), l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      rows.push({ selector, text: element.textContent.trim().slice(0, 70), ratio: +ratio.toFixed(2), minimum: large ? 3 : 4.5 });
    }
    return rows;
  });
  report.contrast.push({ name, results });
  if (!before) for (const row of results) check(`${name}: text contrast ${row.selector} ${row.text.slice(0, 25)}`, row.ratio >= row.minimum, row);
}

async function inspectFoundation(page, context, name) {
  if (before) return;
  const scale = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;width:var(--sp-space-1);height:var(--sp-control-height-md)';
    document.body.appendChild(probe); const box = probe.getBoundingClientRect(); probe.remove();
    return { root: getComputedStyle(document.documentElement).fontSize, body: getComputedStyle(document.body).fontSize,
      space: box.width, control: box.height, family: getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('14px Inter') };
  });
  check(`${name}: root 16px, body 14px, spacing 4px, control 40px`, scale.root === '16px' && scale.body === '14px' && scale.space === 4 && scale.control === 40, scale);
  check(`${name}: Inter declared and loaded`, scale.loaded && /Inter/.test(scale.family), scale);
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root: documentNode } = await cdp.send('DOM.getDocument');
  const heading = page.locator('h1, h2').filter({ visible: true }).first();
  await heading.evaluate(element => element.setAttribute('data-qa-font-heading', ''));
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: '[data-qa-font-heading]' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  report.fonts.push({ name, fonts });
  check(`${name}: Inter actually renders heading glyphs`, fonts.some(font => /Inter/i.test(font.familyName) && font.glyphCount > 0), fonts);
  await cdp.detach();
}

async function keyboardChecks(page, width, tag) {
  if (width < 768) {
    const opener = page.getByRole('button', { name: 'Abrir menu', exact: true });
    if (!before) await page.evaluate(() => {
      window.qaFocusEvents = [];
      document.addEventListener('focusin', event => window.qaFocusEvents.push({ tag: event.target.tagName, class: event.target.className }));
      window.qaFocusCalls = [];
      const focus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function (...args) {
        window.qaFocusCalls.push({ class: this.className, visibility: getComputedStyle(this).visibility, display: getComputedStyle(this).display, inert: !!this.closest('[inert]'), shell: this.closest('.app-shell')?.className, parentVisibility: getComputedStyle(this.closest('.sidebar') || this).visibility, transition: getComputedStyle(this.closest('.sidebar') || this).transition });
        return focus.apply(this, args);
      };
    });
    await opener.click();
    await page.getByRole('button', { name: 'Fechar menu', exact: true }).waitFor();
    await capture(page, `${tag}-sidebar-open`);
    if (!before) {
      await page.waitForFunction(() => document.activeElement?.matches('.sidebar-close'), null, { timeout: 2000 }).catch(() => {});
      check(`${tag}: mobile drawer focuses close control`, await page.getByRole('button', { name: 'Fechar menu', exact: true }).evaluate(el => el === document.activeElement), await page.evaluate(() => ({ tag: document.activeElement?.tagName, class: document.activeElement?.className, focusEvents: window.qaFocusEvents, focusCalls: window.qaFocusCalls })));
      check(`${tag}: background is inert`, await page.locator('.workspace').evaluate(el => el.inert));
      await page.keyboard.press('Shift+Tab');
      check(`${tag}: drawer traps backward tab`, await page.locator('.sidebar').evaluate(el => el.contains(document.activeElement)));
    }
    if (before) await page.getByRole('button', { name: 'Fechar menu', exact: true }).click();
    else await page.keyboard.press('Escape');
    if (!before) {
      await page.waitForFunction(() => document.activeElement?.matches('.menu-button'), null, { timeout: 2000 }).catch(() => {});
      check(`${tag}: drawer Escape restores opener`, await opener.evaluate(el => el === document.activeElement), await page.evaluate(() => ({ tag: document.activeElement?.tagName, class: document.activeElement?.className })));
    }
  } else {
    const collapse = page.getByTestId('sidebar-collapse');
    await collapse.click();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 220)));
    if (!before) check(`${tag}: compact sidebar is 72px`, Math.abs(await page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().width) - 72) <= 1);
    await capture(page, `${tag}-sidebar-compact`);
    await collapse.click();
  }
  const profile = page.getByRole('button', { name: 'Menu do usuário', exact: true });
  await profile.click(); await page.getByRole('menu').waitFor();
  await capture(page, `${tag}-profile-open`);
  if (!before) {
    await page.keyboard.press('End');
    check(`${tag}: profile End focuses sign out`, await page.getByRole('menuitem', { name: 'Sair', exact: true }).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Home');
    check(`${tag}: profile Home focuses first theme`, await page.getByRole('menuitemradio', { name: 'Claro', exact: true }).evaluate(el => el === document.activeElement));
  }
  if (before) await page.locator('.profile-backdrop').click({ position: { x: 2, y: 2 } });
  else await page.keyboard.press('Escape');
  if (!before) check(`${tag}: profile Escape restores trigger`, await profile.evaluate(el => el === document.activeElement));
}

async function importPreview(page, tag) {
  await page.getByLabel('Arquivo ICS').setInputFiles({ name: 'synthetic-qa.ics', mimeType: 'text/calendar',
    buffer: Buffer.from('BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:qa-new\nDTSTART:20261117T120000Z\nDTEND:20261117T130000Z\nSUMMARY:Evento de teste\nEND:VEVENT\nEND:VCALENDAR') });
  await page.getByLabel('Identificador do calendário de origem').fill('qa-source');
  await page.getByRole('combobox', { name: /^Calendário de destino/ }).selectOption('personal-a');
  await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
  await page.getByRole('region', { name: 'Prévia da importação' }).waitFor();
  check(`${tag}: import requires explicit confirmation`, await page.getByRole('button', { name: 'Importar eventos autorizados' }).isDisabled());
  check(`${tag}: preview distinguishes ready, duplicate and blocked`, await page.getByText('Evento novo de teste', { exact: true }).isVisible()
    && await page.getByText('Evento já importado', { exact: true }).isVisible() && await page.getByText('Evento sem horário', { exact: true }).isVisible());
  await capture(page, `${tag}-import-preview`);
}

async function stateChecks(page, state, base, tag) {
  state.users = 'loading';
  await page.goto(base + '/admin/users');
  await page.getByText(/Carregando usuários/).waitFor();
  await capture(page, `${tag}-users-loading`);
  state.users = 'empty'; state.releaseUsers();
  await page.getByTestId('users-empty').waitFor();
  await capture(page, `${tag}-users-empty`);
  state.users = 'error'; await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByTestId('users-load-error').waitFor();
  await capture(page, `${tag}-users-error`);
  state.users = 'normal'; await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.getByRole('cell', { name: member.userFullName + ' ' + member.userEmail, exact: false }).first().waitFor();
  check(`${tag}: retry restores users without navigation`, await page.getByTestId('users-load-error').count() === 0);
  await capture(page, `${tag}-users-retry`);
  state.pending = 'empty'; await page.goto(base + '/pending');
  await page.getByText('Nenhuma pendência encontrada', { exact: false }).waitFor();
  await capture(page, `${tag}-pending-empty`); state.pending = 'normal';
}

async function catalogBooking(page, state, base, tag, viewport) {
  state.catalogBooking = true;
  try {
    await page.goto(base + '/calendar');
    await page.getByRole('button', { name: 'Novo evento', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const search = dialog.getByRole('combobox', { name: 'O que será feito?' });
    await dialog.locator('[formcontrolname="clientName"]').fill('Cliente de teste');
    for (const item of catalogItems) {
      await search.fill(item.name);
      await dialog.getByRole('option', { name: new RegExp(item.name) }).click();
    }
    await dialog.getByRole('spinbutton', { name: 'Quantidade de Procedimento de teste' }).fill('2');
    await dialog.locator('.catalog-total').getByText(/112,50/).waitFor();
    check(`${tag}: booking totals multiple contracted items`, /112,50/.test(await dialog.locator('.catalog-total').innerText()));
    check(`${tag}: booking proposes one hour from quantities`, await dialog.getByRole('combobox', { name: 'Duração' }).inputValue() === '60');
    check(`${tag}: booking previews client and calendar`, /Cliente de teste/.test(await dialog.locator('.appointment-preview').innerText()));
    check(`${tag}: CLIENT recurrence remains unavailable`, await dialog.locator('app-recurrence-editor').count() === 0);
    await dialog.getByLabel('Observações (opcional)').fill('Observação de teste');
    await capture(page, `${tag}-catalog-booking`);
    if (viewport.width === 390) {
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      const submit = dialog.getByRole('button', { name: 'Criar evento', exact: true });
      await submit.scrollIntoViewIfNeeded();
      check(`${tag}: rotation keeps the booking usable`, await submit.isVisible() && await submit.isEnabled());
      await capture(page, `${tag}-catalog-booking-rotated`);
      await page.setViewportSize(viewport);
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  } finally {
    state.catalogBooking = false;
  }
}

async function run() {
  assert.ok(fs.existsSync(root), 'Browser build directory must exist');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const routes = [
    ['finance', 'Resumo de receitas'], ['finance/catalog', 'Catálogo'], ['members', 'Membros dos calendários'], ['admin/users', 'Usuários'],
    ['admin/roles', 'Perfis e Permissões'], ['audit', 'Auditoria'], ['pending', 'Pendências'],
    ['calendar-import', 'Importar Google Calendar'], ['settings', 'Configurações'],
  ];
  try {
    const viewports = before
      ? [{ width: 1440, height: 960 }, { width: 390, height: 844 }, { width: 1024, height: 960 }]
      : [{ width: 1440, height: 960 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
         { width: 900, height: 480 }, { width: 320, height: 640 }];
    for (const theme of ['light', 'dark']) for (const viewport of viewports) {
      const { width } = viewport;
      const tag = `${theme}-${width}`;
      if (process.env.PLANNER_QA_SCENARIO && process.env.PLANNER_QA_SCENARIO !== tag) continue;
      const touch = width <= 390 || viewport.height === 480;
      const context = await browser.newContext({ viewport, hasTouch: touch,
        timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
      const state = { users: 'normal', pending: 'normal' };
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base && ['http:', 'https:'].includes(url.protocol)) {
          report.externalRequests.push(url.origin + url.pathname); await route.abort('blockedbyclient');
        } else await route.fallback();
      });
      await installFixtures(context, state);
      await context.addInitScript(preference => {
        if (!localStorage.getItem('sharedPlanner.theme')) localStorage.setItem('sharedPlanner.theme', preference);
        // Both builds receive the same date, while native timers continue normally.
        const RealDate = Date; const now = new RealDate('2026-11-17T15:00:00Z').getTime();
        window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
      }, theme);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', error => report.consoleErrors.push(`${tag}: ${error.message}`));
      try {
        await page.goto(base + '/login'); await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
        check(`${tag}: login honors theme`, await page.locator('html').getAttribute('data-theme') === theme);
        await capture(page, `${tag}-login`); await inspectContrast(page, `${tag}-login`);
        await inspectFoundation(page, context, `${tag}-login`);
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await page.getByText('Informe seu e-mail.', { exact: true }).waitFor();
        await capture(page, `${tag}-login-validation`);
        await page.evaluate(() => localStorage.setItem('sharedPlanner.token', 'synthetic-render-session'));
        await page.goto(base + '/calendar'); await page.getByRole('heading', { name: 'Calendário', exact: true }).waitFor();
        await page.locator('.fc-daygrid-body').waitFor(); await page.locator('.fc-daygrid-event').first().waitFor();
        await capture(page, `${tag}-calendar`); await inspectContrast(page, `${tag}-calendar`);
        if (width <= 390 || width === 1440) await keyboardChecks(page, width, tag);
        if (!before && touch) {
          const filters = page.locator('.mobile-filter-toggle');
          check(`${tag}: calendar filters start collapsed`, await filters.getAttribute('aria-expanded') === 'false');
          await filters.click();
          const filterGroup = page.getByRole('group', { name: 'Filtrar por tipo de evento' });
          await filterGroup.waitFor();
          check(`${tag}: calendar filters are available on demand`, await filterGroup.isVisible());
          await filters.click();
          const agenda = page.getByRole('region', { name: 'Eventos por dia' });
          await agenda.getByRole('button', { name: /Atendimento de teste|Cliente de teste/ }).click();
          const detail = page.getByRole('dialog');
          await detail.waitFor();
          await capture(page, `${tag}-event-detail`);
          await page.keyboard.press('Escape');
          await detail.waitFor({ state: 'detached' });
        }
        const create = page.getByRole('button', { name: 'Novo evento', exact: true });
        await create.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
        check(`${tag}: one click opens event form`, await dialog.isVisible());
        await dialog.getByLabel('Telefone do cliente').fill('11912345678');
        check(`${tag}: phone mask preserved`, await dialog.getByLabel('Telefone do cliente').inputValue() === '(11) 91234-5678');
        check(`${tag}: event form has one description field`, await dialog.locator('textarea').count() === 1);
        await capture(page, `${tag}-event-modal`); await inspectContrast(page, `${tag}-event-modal`);
        if (!before) {
          await page.keyboard.press('Shift+Tab');
          check(`${tag}: event modal keeps keyboard focus`, await dialog.evaluate(el => el.contains(document.activeElement)));
        }
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        for (const [route, heading] of routes) {
          if (before && width === 1024 && !['finance', 'finance/catalog', 'admin/users', 'settings'].includes(route)) continue;
          await page.goto(base + '/' + route); await page.getByRole('heading', { name: heading, exact: true }).waitFor();
          if (route === 'admin/users') await page.getByTestId('open-create-user').waitFor();
          if (route === 'finance') {
            await page.locator('[data-testid="expected-amount"]').waitFor();
            await page.locator('sp-line-chart .sp-line-series.primary').waitFor();
          }
          if (route === 'finance/catalog') {
            await page.getByRole('row', { name: /Procedimento de teste/ }).waitFor();
            if (!before) {
              const search = page.getByRole('searchbox', { name: 'Busca', exact: true });
              const expand = page.getByRole('button', { name: 'Expandir filtros' });
              if (await expand.isVisible()) await expand.click();
              await search.fill('Consulta');
              await page.getByRole('button', { name: 'Recolher filtros' }).click();
              await search.waitFor({ state: 'hidden' });
              check(`${tag}: catalogue filters collapse`, !await search.isVisible());
              await page.getByRole('button', { name: 'Expandir filtros' }).click();
              await search.waitFor();
              check(`${tag}: catalogue keeps the filter value`, await search.inputValue() === 'Consulta');
              if (width <= 390) {
                await page.getByRole('button', { name: 'Recolher filtros' }).click();
                await search.waitFor({ state: 'hidden' });
              }
            }
          }
          if (route === 'members') await page.getByText(member.userEmail, { exact: true }).first().waitFor();
          if (route === 'pending') await page.getByRole('heading', { name: 'Planejamento compartilhado' }).waitFor();
          if (route === 'audit') await page.getByText(audit[0].summary, { exact: true }).waitFor();
          const name = `${tag}-${route.replaceAll('/', '-')}`;
          await capture(page, name); await inspectContrast(page, name);
          if (route === 'finance') {
            await page.locator('.sp-line-plot').scrollIntoViewIfNeeded();
            await capture(page, `${tag}-finance-charts`);
            if (!before) {
              const plot = page.locator('.sp-line-plot');
              check(`${tag}: revenue chart fits its panel`, await plot.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
              await plot.locator('.sp-line-point').first().focus();
              check(`${tag}: revenue point opens keyboard tooltip`, await plot.locator('.sp-line-tooltip').isVisible());
            }
          }
          if (route === 'calendar-import') await importPreview(page, tag);
          if (route === 'settings') {
            check(`${tag}: account identity is read-only`, await page.locator('[data-testid="account-info"] input').count() === 0);
            if (!before) {
              await page.getByTestId('theme-light').focus(); await page.keyboard.press('ArrowRight');
              check(`${tag}: theme radio keyboard selects dark`, await page.locator('html').getAttribute('data-theme') === 'dark');
              await page.reload(); check(`${tag}: theme persists after reload`, await page.locator('html').getAttribute('data-theme') === 'dark');
              await page.getByTestId(`theme-${theme}`).click();
            }
          }
        }
        if (width === 1440 || width === 390) {
          await stateChecks(page, state, base, tag);
          if (!before) await catalogBooking(page, state, base, tag, viewport);
        }
      } catch (error) {
        report.failures.push(`${tag}: ${error.stack}`); persist();
        await page.screenshot({ path: path.join(output, `${tag}-failure.png`), fullPage: true }).catch(() => {});
      } finally { if (state.releaseUsers) state.releaseUsers(); await context.close(); }
      console.log(`Completed ${tag}: ${report.screenshots.length} captures, ${report.failures.length} failures`);
    }
    const system = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 960 } });
    await system.route('**/api/**', route => route.fulfill({ status: 200, json: [] }));
    const page = await system.newPage(); await page.goto(base + '/login');
    await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    check('System theme follows dark OS', await page.locator('html').getAttribute('data-theme') === 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    check('System theme follows OS changes', await page.locator('html').getAttribute('data-theme') === 'light');
    await capture(page, 'system-light-login'); await system.close();
    check('No runtime page exceptions', report.consoleErrors.length === 0, report.consoleErrors);
    check('No external network requests', report.externalRequests.length === 0, report.externalRequests);
  } finally {
    report.finishedAt = new Date().toISOString(); persist(); await browser.close(); await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify({ mode: report.mode, screenshots: report.screenshots.length, checks: report.checks.length,
    failures: report.failures.length, report: path.join(output, 'report.json') }));
  assert.equal(report.failures.length, 0, report.failures.join('\n'));
}

run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

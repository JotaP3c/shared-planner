/* Read-only browser validation against the authorized local development runtime.
 * Login creates a session; this script never creates/edits/deletes application data.
 * Real screenshots stay in a private directory outside Git.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLANNER_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PLANNER_LOCAL_URL || 'http://localhost:4200';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Local runtime required');
const credentialsPath = process.env.PLANNER_CREDENTIALS_FILE || path.join(os.homedir(), 'postgres-local/admin-credentials.txt');
const credentials = Object.fromEntries(fs.readFileSync(credentialsPath, 'utf8').split(/\r?\n/)
  .filter(line => /^(email|password)=/.test(line)).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
const output = process.env.PLANNER_PRIVATE_QA_OUTPUT;
assert.ok(output && path.isAbsolute(output), 'An explicit private screenshot directory is required');
for (const repo of ['shared-planner', 'shared-planner-backend', 'shared-planner-frontend']) {
  assert.ok(!path.resolve(output).toLowerCase().startsWith(path.resolve('C:/git', repo).toLowerCase() + path.sep), 'Real screenshots cannot be stored in Git');
}
fs.mkdirSync(output, { recursive: true });

async function verifyAcademyViews(page) {
  const referenceDate = '2026-11-11';
  const token = await page.evaluate(() => localStorage.getItem('sharedPlanner.token'));
  assert.ok(token, 'The local login must provide an authenticated session');
  const headers = { Authorization: `Bearer ${token}` };
  const calendarsResponse = await page.request.get(base + '/api/calendars', { headers });
  assert.equal(calendarsResponse.status(), 200, 'Authorized calendars API');
  const calendars = await calendarsResponse.json();
  const candidates = [];
  for (const calendar of calendars) {
    const query = new URLSearchParams({ calendarId: calendar.id,
      start: `${referenceDate}T00:00:00`, end: '2026-11-12T00:00:00' });
    const response = await page.request.get(`${base}/api/events?${query}`, { headers });
    assert.equal(response.status(), 200, 'Authorized events API');
    const events = await response.json();
    for (const event of events) {
      if (event.externalSource === 'GOOGLE_ICS' && event.eventType === 'PERSONAL'
          && event.title.trim() === 'Academia'
          && event.startsAt.slice(0, 19) === `${referenceDate}T16:00:00`
          && event.endsAt.slice(0, 19) === `${referenceDate}T17:00:00`) {
        candidates.push({ calendar, event });
      }
    }
  }
  assert.equal(candidates.length, 1, 'Exactly one authorized imported Academy occurrence must match the SDD reference');
  const { calendar, event } = candidates[0];
  assert.equal(calendar.calendarType, 'PERSONAL');
  assert.notEqual(event.status, 'CANCELLED', 'The reference occurrence is active');

  const target = new URLSearchParams({ eventId: event.id, calendarId: calendar.id, date: referenceDate });
  await page.goto(`${base}/calendar?${target}`);
  const detail = page.locator('.event-detail-panel');
  await detail.waitFor();
  await detail.getByRole('button', { name: 'Fechar', exact: true }).click();
  await detail.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Calendários:/ }).click();
  const filter = page.locator('.filter-popover');
  await filter.waitFor();
  // Names and IDs come from the authorized API; no private calendar identifiers are fixtures.
  for (const available of calendars) {
    const checkbox = filter.getByRole('checkbox', { name: available.name, exact: true });
    await checkbox.setChecked(available.id === calendar.id);
  }
  assert.equal(await filter.locator('input[type=checkbox]:checked').count(), 1);
  await page.keyboard.press('Escape');

  const academy = scope => scope.locator('.fc-event').filter({
    has: page.locator('.sp-event-title').filter({ hasText: /^\s*Academia\s*$/ }),
  });
  for (const [view, fileName] of [['Mês', 'month'], ['Semana', 'week'], ['Dia', 'day']]) {
    await page.getByRole('button', { name: view, exact: true }).click();
    const isMonth = view === 'Mês';
    const cell = page.locator(isMonth
      ? `.fc-daygrid-day[data-date="${referenceDate}"]`
      : `.fc-timegrid-col[data-date="${referenceDate}"]`);
    await cell.waitFor();
    let occurrence = academy(cell).first();
    if (isMonth && !await occurrence.isVisible()) {
      // The month view deliberately limits visible rows; opening "more" is read-only.
      const more = cell.locator('.fc-daygrid-more-link');
      await more.waitFor();
      await more.click();
      const popover = page.locator('.fc-more-popover');
      await popover.waitFor();
      occurrence = academy(popover).first();
    }
    await occurrence.waitFor();
    await occurrence.scrollIntoViewIfNeeded();
    assert.equal((await occurrence.locator('.sp-event-title').textContent()).trim(), 'Academia');
    assert.match((await occurrence.locator('.sp-event-time').textContent()).trim(), /^16:00\s*-\s*17:00$/,
      `Academy civil time in ${fileName} view`);
    await page.screenshot({ path: path.join(output, `academy-${fileName}-${referenceDate}.png`) });
    if (isMonth && await page.locator('.fc-more-popover').isVisible()) {
      await page.locator('.fc-more-popover .fc-popover-close').click();
    }
  }
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    const blockedMutations = [];
    await page.route('**/api/**', async route => {
      const request = route.request(), method = request.method();
      const login = method === 'POST' && new URL(request.url()).pathname === '/api/auth/login';
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !login) {
        blockedMutations.push(`${method} ${new URL(request.url()).pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('E-mail', { exact: true }).fill(credentials.email);
    await page.getByLabel('Senha', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('heading', { name: 'Calendário', exact: true }).waitFor();
    await page.locator('.fc-daygrid-body').waitFor();
    await page.getByRole('button', { name: /^Calendários:/ }).click();
    await page.locator('.filter-popover .filter-option').first().waitFor();
    const calendarCheckboxes = await page.locator('.filter-popover input[type=checkbox]').count();
    assert.ok(calendarCheckboxes >= 5, 'Separate authorized calendars must appear');
    assert.equal(await page.locator('.filter-options').getByText('Feriados no Brasil · 2026', { exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, 'calendar-month.png') });
    for (const view of ['Semana', 'Dia', 'Mês']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.locator(view === 'Mês' ? '.fc-daygrid-body' : '.fc-timegrid-body').waitFor();
    }
    await verifyAcademyViews(page);
    await page.goto(base + '/finance');
    await page.getByRole('heading', { name: 'Resumo de receitas', exact: true }).waitFor();
    await page.getByLabel('Consolidar calendários').check();
    await page.locator('[data-testid="expected-amount"]').waitFor();
    await page.locator('[data-testid="confirmation-chart"] svg').waitFor();
    assert.equal(await page.getByText('Não foi possível carregar a evolução e os atendimentos recentes.', { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(output, 'finance.png') });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(blockedMutations, [], 'The browser check must never attempt an application mutation');
    console.log(`PASS: real local login, separate calendars=${calendarCheckboxes}, Academy 2026-11-11 16:00-17:00 in month/week/day, finance and confirmation charts; no application data changed; private screenshots=${output}`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });

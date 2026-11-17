/* Optional real-browser render checks with synthetic HTTP fixtures only.
 * Run after ng build. Supply PLANNER_PLAYWRIGHT_MODULE pointing to an installed
 * Playwright module and PLANNER_QA_OUTPUT for screenshots. No real login/database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLANNER_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.PLANNER_BROWSER_BUILD_DIR || path.resolve(__dirname, '../dist/shared-planner-frontend/browser'));
const output = process.env.PLANNER_QA_OUTPUT || path.join(os.tmpdir(), 'shared-planner-browser-smoke');
const exportFixture = path.resolve(__dirname, '../../backend/target/finance-export/financial-report-synthetic.xlsx');
fs.mkdirSync(output, { recursive: true });
const user = { id: 'test-user', fullName: 'Conta de teste', email: 'account@example.invalid', role: 'FINANCE', active: true,
  permissions: ['CALENDAR_VIEW', 'CALENDAR_CREATE', 'SETTINGS_VIEW', 'FINANCE_MEMBER_CALENDARS'] };
const adminCalendarPermissions = ['CALENDAR_VIEW', 'EVENT_CREATE', 'EVENT_EDIT', 'EVENT_EDIT_ALL', 'EVENT_CANCEL', 'EVENT_APPROVE',
  'FINANCE_VIEW', 'FINANCE_MANAGE', 'FINANCE_EXPORT', 'MEMBERS_VIEW', 'MEMBERS_MANAGE', 'AUDIT_VIEW', 'CALENDAR_IMPORT'];
const calendars = [
  { id: 'personal-a', name: 'Calendário de teste A', ownerEmail: user.email, calendarType: 'PERSONAL', memberRole: 'ADMIN', memberRoles: ['ADMIN'], canCreateEvents: true, permissions: adminCalendarPermissions },
  { id: 'personal-b', name: 'Calendário de teste B', ownerEmail: 'other@example.invalid', calendarType: 'PERSONAL', memberRole: 'EDITOR', memberRoles: ['EDITOR', 'FINANCE'], canCreateEvents: true,
    permissions: ['CALENDAR_VIEW', 'EVENT_CREATE', 'EVENT_EDIT', 'EVENT_CANCEL', 'EVENT_APPROVE', 'FINANCE_VIEW', 'FINANCE_MANAGE', 'FINANCE_EXPORT', 'MEMBERS_VIEW'] },
  { id: 'shared', name: 'Calendário compartilhado de teste', ownerEmail: user.email, calendarType: 'SHARED', memberRole: 'ADMIN', memberRoles: ['ADMIN'], canCreateEvents: true, permissions: adminCalendarPermissions },
];
const summary = (url) => ({ calendarId: url.searchParams.get('calendarId'), startDate: url.searchParams.get('startDate'), endDate: url.searchParams.get('endDate'),
  expectedAmount: 100, receivedAmount: 40, pendingAmount: 60, appointmentCount: 1, paidCount: 0, pendingCount: 0, partiallyPaidCount: 1, refundedCount: 0,
  confirmedAmount: 0, unconfirmedAmount: 100, unscheduledAmount: 0, confirmedCount: 0, awaitingConfirmationCount: 1, rescheduledCount: 0, unscheduledCount: 0, rescheduleOccurrences: 0 });
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const requested = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (requested !== root && !requested.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.csr.html');
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

async function fixtures(context, actor = user) {
  const profiles = [
    { id: 'calendar-viewer', code: 'CALENDAR_VIEWER', name: 'Visualizador', scope: 'CALENDAR', active: true, builtIn: true, permissions: ['CALENDAR_VIEW'] },
  ];
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname === '/api/auth/me') body = actor;
    else if (url.pathname === '/api/calendars') body = calendars;
    else if (url.pathname === '/api/access/permissions') body = [
      { code: 'CALENDAR_VIEW', module: 'Calendário', label: 'Visualizar calendário', globalOnly: false },
      { code: 'FINANCE_VIEW', module: 'Financeiro', label: 'Consultar financeiro', globalOnly: false },
      { code: 'ROLES_MANAGE', module: 'Administração', label: 'Gerenciar perfis globais', globalOnly: true },
    ];
    else if (url.pathname === '/api/access/users') body = [actor];
    else if (url.pathname === '/api/access/profiles') {
      if (route.request().method() === 'POST') {
        const requested = route.request().postDataJSON();
        assert.equal(requested.scope, 'CALENDAR');
        assert.deepEqual(requested.permissions, ['CALENDAR_VIEW', 'FINANCE_VIEW']);
        body = { id: 'custom-profile', code: 'CUSTOM_BROWSER_PROFILE', builtIn: false, ...requested };
        profiles.push(body);
      } else body = profiles;
    }
    else if (url.pathname.endsWith('/members')) body = [{ id: 'membership', calendarId: 'personal-a', userEmail: user.email, userFullName: user.fullName, role: 'ADMIN', roles: ['ADMIN'], createdAt: '2026-11-01T10:00:00' }];
    else if (url.pathname === '/api/finance/summary') body = summary(url);
    else if (url.pathname === '/api/finance/export') {
      assert.ok(fs.existsSync(exportFixture), 'A validated synthetic XLSX fixture is required for the download check');
      await route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="shared-planner-financial-report-2026-11.xlsx"' }, body: fs.readFileSync(exportFixture) });
      return;
    }
    else if (url.pathname === '/api/finance/timeline') body = { ...summary(url), granularity: 'DAY', points: Array.from({ length: 30 }, (_, index) => ({
      date: `2026-11-${String(index + 1).padStart(2, '0')}`, expectedAmount: [10, 11].includes(index) ? 50 : 0,
      receivedAmount: [10, 11].includes(index) ? 20 : 0, appointmentCount: index === 10 ? 1 : 0,
    })) };
    else if (url.pathname === '/api/holidays') body = { calendarId: 'system:holidays:BR:2026', calendarName: 'Feriados no Brasil', country: 'BR', year: 2026,
      holidays: [{ id: 'br-2026-11-15', title: 'Proclamação da República', startDate: '2026-11-15', endDateExclusive: '2026-11-16', sourceUrl: 'https://www.gov.br/' }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  let checks = 0;
  let downloads = 0;
  try {
    for (const theme of ['light', 'dark']) {
      for (const [width, height] of [[1440, 900], [1280, 720], [1024, 640], [390, 844]]) {
        const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Sao_Paulo' });
        await context.addInitScript(preference => localStorage.setItem('sharedPlanner.theme', preference), theme);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/login');
        await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.getByText('Acesso protegido por autenticação com token.').count(), 0);
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await page.getByText('Informe seu e-mail.').waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Login overflow ${theme}/${width}`);
        await page.screenshot({ path: path.join(output, `login-${theme}-${width}.png`), fullPage: true });
        await fixtures(context);
        await page.evaluate(() => localStorage.setItem('sharedPlanner.token', 'synthetic-browser-session'));
        await page.goto(base + '/calendar');
        await page.getByRole('heading', { name: 'Calendário', exact: true }).waitFor();
        await page.locator('.fc-daygrid-body').waitFor();
        const holiday = page.locator('.sp-holiday .fc-event-main');
        await holiday.first().waitFor();
        assert.ok(await holiday.first().evaluate(element => {
          const expected = document.createElement('span');
          expected.style.color = 'var(--sp-holiday-text)';
          document.body.appendChild(expected);
          const match = getComputedStyle(element).color === getComputedStyle(expected).color;
          expected.remove();
          return match;
        }), 'Holiday text follows the theme token');
        await page.getByRole('button', { name: /^Calendários:/ }).click();
        await page.locator('.filter-popover .filter-option').first().waitFor();
        assert.equal(await page.locator('.filter-options').getByText('Feriados no Brasil · 2026', { exact: true }).count(), 0);
        const calendarChoices = page.locator('.filter-popover input[type=checkbox]');
        assert.equal(await calendarChoices.count(), calendars.length);
        for (const choice of await calendarChoices.all()) await choice.uncheck();
        await page.keyboard.press('Escape');
        await holiday.first().waitFor();
        await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        await page.screenshot({ path: path.join(output, `calendar-${theme}-${width}.png`), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Calendar overflow ${theme}/${width}`);
        await page.getByRole('button', { name: 'Novo evento', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await dialog.getByLabel('Telefone do cliente').fill('11912345678');
        assert.equal(await dialog.getByLabel('Telefone do cliente').inputValue(), '(11) 91234-5678');
        assert.equal(await dialog.locator('textarea').count(), 1);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        await page.goto(base + '/admin/users');
        await page.getByRole('heading', { name: 'Acesso não autorizado', exact: true }).waitFor();
        await page.goto(base + '/admin/roles');
        await page.getByRole('heading', { name: 'Acesso não autorizado', exact: true }).waitFor();
        if (width === 1440 || width === 390) {
          await page.goto(base + '/finance');
          await page.getByRole('heading', { name: 'Resumo de receitas', exact: true }).waitFor();
          await page.getByLabel('Consolidar calendários').check();
          await page.getByText('R$ 300,00', { exact: true }).first().waitFor();
          await page.locator('sp-line-chart .sp-line-series.primary').waitFor();
          const scopeBeforeCollapse = await page.locator('[data-testid="expected-amount"]').textContent();
          await page.getByRole('button', { name: 'Recolher filtros', exact: true }).click();
          await page.locator('#finance-filter-controls').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#finance-filter-controls').isVisible(), false);
          assert.match(await page.locator('[data-testid="finance-filter-summary"]').textContent(), /Consolidado.*3 calendários/);
          await page.getByRole('button', { name: 'Expandir filtros', exact: true }).click();
          await page.locator('#finance-filter-controls').waitFor({ state: 'visible' });
          assert.equal(await page.getByLabel('Consolidar calendários').isChecked(), true);
          assert.equal(await page.locator('[data-testid="expected-amount"]').textContent(), scopeBeforeCollapse);
          await page.getByRole('button', { name: 'Recolher gráficos', exact: true }).click();
          await page.locator('#finance-charts').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#finance-charts').isVisible(), false);
          await page.getByRole('button', { name: 'Expandir gráficos', exact: true }).click();
          await page.locator('#finance-charts').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Exportar Excel', exact: true }).waitFor();
          if (fs.existsSync(exportFixture)) {
            const [download] = await Promise.all([
              page.waitForEvent('download'),
              page.getByRole('button', { name: 'Exportar Excel', exact: true }).click(),
            ]);
            assert.equal(download.suggestedFilename(), 'shared-planner-financial-report-2026-11.xlsx');
            assert.equal(fs.statSync(await download.path()).size, fs.statSync(exportFixture).size);
            downloads++;
          }
          assert.ok(await page.locator('.summary-heading').evaluate(element => {
            const caption = element.querySelector('small');
            return caption && caption.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1;
          }), 'Finance period stays inside its heading');
          await page.screenshot({ path: path.join(output, `finance-${theme}-${width}.png`), fullPage: true });
          await page.locator('[data-testid="revenue-evolution-chart"]').screenshot({ path: path.join(output, `finance-chart-${theme}-${width}.png`) });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Finance overflow ${theme}/${width}`);
          assert.ok(await page.locator('main.content').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Finance content overflow ${theme}/${width}`);
          await page.goto(base + '/members');
          await page.getByRole('heading', { name: 'Membros dos calendários', exact: true }).waitFor();
          await page.screenshot({ path: path.join(output, `members-${theme}-${width}.png`), fullPage: true });
        }
        checks++;
        await context.close();
      }
    }
    const context = await browser.newContext({ colorScheme: 'dark' });
    const one = await context.newPage();
    const two = await context.newPage();
    await one.goto(base + '/login');
    await two.goto(base + '/login');
    await one.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    await two.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    assert.equal(await one.locator('html').getAttribute('data-theme'), 'dark');
    await one.evaluate(() => localStorage.setItem('sharedPlanner.theme', 'light'));
    await two.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await two.reload();
    assert.equal(await two.locator('html').getAttribute('data-theme'), 'light');
    await context.close();
    for (const [theme, width] of [['light', 1440], ['dark', 390]]) {
      const accessContext = await browser.newContext({ viewport: { width, height: 900 } });
      await accessContext.addInitScript(preference => {
        localStorage.setItem('sharedPlanner.theme', preference);
        localStorage.setItem('sharedPlanner.token', 'synthetic-browser-session');
      }, theme);
      const actor = { ...user, role: 'USER', permissions: [...user.permissions, 'ROLES_MANAGE'] };
      await fixtures(accessContext, actor);
      const accessPage = await accessContext.newPage();
      accessPage.on('pageerror', error => errors.push(error.message));
      await accessPage.goto(base + '/admin/roles');
      await accessPage.getByRole('heading', { name: 'Perfis e Permissões', exact: true }).waitFor();
      await accessPage.getByRole('button', { name: 'Novo perfil', exact: true }).click();
      const editor = accessPage.getByRole('region', { name: 'Editar permissões', exact: true });
      await editor.getByLabel('Nome', { exact: true }).fill('Consulta financeira de teste');
      assert.equal(await editor.getByLabel('Gerenciar perfis globais', { exact: true }).count(), 0);
      await editor.getByRole('checkbox', { name: /^Visualizar calendário/ }).check();
      await editor.getByRole('checkbox', { name: /^Consultar financeiro/ }).check();
      await editor.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
      await accessPage.getByRole('status').filter({ hasText: 'Perfil salvo.' }).waitFor();
      await accessPage.getByRole('button', { name: /Consulta financeira de teste/ }).waitFor();
      assert.ok(await accessPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Access profiles overflow ${theme}/${width}`);
      assert.ok(await accessPage.locator('main.content').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Access profiles content overflow ${theme}/${width}`);
      await accessPage.screenshot({ path: path.join(output, `access-profiles-${theme}-${width}.png`), fullPage: true });
      await accessContext.close();
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`PASS: ${checks} theme/resolution scenarios + 2 configurable-profile scenarios + system theme/storage/reload; XLSX downloads=${downloads}; synthetic HTTP fixtures; screenshots=${output}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
module.exports = { fixtures, user, calendars, adminCalendarPermissions, summary };
if (require.main === module) {
  run().catch(error => { console.error(error.message); server.close(); process.exitCode = 1; });
}

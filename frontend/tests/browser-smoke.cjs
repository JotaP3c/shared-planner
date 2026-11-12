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
const root = path.resolve(__dirname, '../dist/shared-planner-frontend/browser');
const output = process.env.PLANNER_QA_OUTPUT || path.join(os.tmpdir(), 'shared-planner-browser-smoke');
fs.mkdirSync(output, { recursive: true });
const user = { id: 'test-user', fullName: 'Conta de teste', email: 'account@example.invalid', role: 'FINANCE', active: true };
const calendars = [
  { id: 'personal-a', name: 'Calendário de teste A', ownerEmail: user.email, calendarType: 'PERSONAL', memberRole: 'ADMIN', memberRoles: ['ADMIN'], canCreateEvents: true },
  { id: 'personal-b', name: 'Calendário de teste B', ownerEmail: 'other@example.invalid', calendarType: 'PERSONAL', memberRole: 'EDITOR', memberRoles: ['EDITOR', 'FINANCE'], canCreateEvents: true },
  { id: 'shared', name: 'Calendário compartilhado de teste', ownerEmail: user.email, calendarType: 'SHARED', memberRole: 'ADMIN', memberRoles: ['ADMIN'], canCreateEvents: true },
];
const summary = (url) => ({ calendarId: url.searchParams.get('calendarId'), startDate: url.searchParams.get('startDate'), endDate: url.searchParams.get('endDate'),
  expectedAmount: 100, receivedAmount: 40, pendingAmount: 60, appointmentCount: 1, paidCount: 0, pendingCount: 0, partiallyPaidCount: 1, refundedCount: 0,
  confirmedAmount: 0, unconfirmedAmount: 100, unscheduledAmount: 0, confirmedCount: 0, awaitingConfirmationCount: 1, rescheduledCount: 0, unscheduledCount: 0, rescheduleOccurrences: 0 });
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const requested = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (requested !== root && !requested.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.csr.html');
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

async function fixtures(context) {
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname === '/api/auth/me') body = user;
    else if (url.pathname === '/api/calendars') body = calendars;
    else if (url.pathname.endsWith('/members')) body = [{ id: 'membership', calendarId: 'personal-a', userEmail: user.email, userFullName: user.fullName, role: 'ADMIN', roles: ['ADMIN'], createdAt: '2026-11-01T10:00:00' }];
    else if (url.pathname === '/api/finance/summary') body = summary(url);
    else if (url.pathname === '/api/finance/timeline') body = { ...summary(url), granularity: 'DAY', points: [{ date: '2026-11-11', expectedAmount: 100, receivedAmount: 40, appointmentCount: 1 }] };
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
        await page.getByRole('heading', { name: 'Calendário', exact: true }).waitFor();
        if (width === 1440 || width === 390) {
          await page.goto(base + '/finance');
          await page.getByRole('heading', { name: 'Resumo de receitas', exact: true }).waitFor();
          await page.getByLabel('Consolidar calendários').check();
          await page.getByText('R$ 300,00', { exact: true }).first().waitFor();
          assert.ok(await page.locator('.summary-heading').evaluate(element => {
            const caption = element.querySelector('small');
            return caption && caption.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1;
          }), 'Finance period stays inside its heading');
          await page.screenshot({ path: path.join(output, `finance-${theme}-${width}.png`), fullPage: true });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Finance overflow ${theme}/${width}`);
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
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`PASS: ${checks} theme/resolution scenarios + system theme/storage/reload; synthetic HTTP fixtures; screenshots=${output}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error.message); server.close(); process.exitCode = 1; });

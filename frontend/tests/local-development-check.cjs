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
async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/login');
    await page.getByLabel('E-mail', { exact: true }).fill(credentials.email);
    await page.getByLabel('Senha', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('heading', { name: 'Calendário', exact: true }).waitFor();
    await page.locator('.fc-daygrid-body').waitFor();
    await page.getByRole('button', { name: /^Calendários:/ }).click();
    await page.locator('.filter-popover .filter-option').nth(5).waitFor();
    const calendarCheckboxes = await page.locator('.filter-popover input[type=checkbox]').count();
    assert.ok(calendarCheckboxes >= 5, 'Separate authorized calendars must appear');
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, 'calendar-month.png') });
    for (const view of ['Semana', 'Dia', 'Mês']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.locator(view === 'Mês' ? '.fc-daygrid-body' : '.fc-timegrid-body').waitFor();
    }
    await page.goto(base + '/finance');
    await page.getByRole('heading', { name: 'Resumo de receitas', exact: true }).waitFor();
    await page.getByLabel('Consolidar calendários').check();
    await page.getByText('R$ 210,00', { exact: true }).first().waitFor();
    await page.getByText('R$ 50,00', { exact: true }).first().waitFor();
    await page.locator('[data-testid="confirmation-chart"] svg').waitFor();
    assert.equal(await page.getByText('Não foi possível carregar a evolução e os atendimentos recentes.', { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(output, 'finance.png') });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`PASS: real local login, separate calendars=${calendarCheckboxes}, month/week/day, finance and confirmation charts; no application data changed; private screenshots=${output}`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });

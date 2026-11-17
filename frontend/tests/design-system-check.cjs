/* Optional browser validation. Uses an external Playwright installation, no app API.
 * PLANNER_PLAYWRIGHT_MODULE: installed Playwright module path.
 * PLANNER_DS_BUILD_DIR: development browser build (default dist/design-system-dev/browser).
 * PLANNER_DS_PRODUCTION_BUILD_DIR: optional production browser build to verify exclusion.
 * PLANNER_QA_OUTPUT: screenshot/report directory outside the repository.
 * --production checks only the production build (defaults to the regular browser output).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLANNER_PLAYWRIGHT_MODULE || 'playwright');

const frontendRoot = path.resolve(__dirname, '..');
const developmentRoot = path.resolve(process.env.PLANNER_DS_BUILD_DIR || path.join(frontendRoot, 'dist/design-system-dev/browser'));
const productionOnly = process.argv.includes('--production');
const productionRoot = process.env.PLANNER_DS_PRODUCTION_BUILD_DIR
  ? path.resolve(process.env.PLANNER_DS_PRODUCTION_BUILD_DIR)
  : productionOnly ? path.join(frontendRoot, 'dist/shared-planner-frontend/browser') : null;
const output = process.env.PLANNER_QA_OUTPUT || path.join(os.tmpdir(), 'shared-planner-design-system-qa');
const marker = 'SP_DESIGN_SYSTEM_SHOWCASE';
const report = { development: [], production: null, contrast: [], unexpectedApiRequests: [], pageErrors: [] };
fs.mkdirSync(output, { recursive: true });

async function serve(root) {
  assert.ok(fs.existsSync(root), `Browser build not found: ${root}`);
  const fallback = ['index.csr.html', 'index.html'].map(file => path.join(root, file)).find(fs.existsSync);
  assert.ok(fallback, `No CSR index found: ${root}`);
  const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
  const server = http.createServer((request, response) => {
    let requested;
    try { requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
    catch { response.writeHead(400).end(); return; }
    if (requested !== root && !requested.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : fallback;
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

async function contextFor(browser, options = {}, theme) {
  const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo', ...options });
  context.setDefaultTimeout(10000);
  if (theme) await context.addInitScript(value => {
    if (!localStorage.getItem('sharedPlanner.theme')) localStorage.setItem('sharedPlanner.theme', value);
  }, theme);
  await context.route('**/api/**', async route => {
    report.unexpectedApiRequests.push(route.request().url());
    await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  return { context, page };
}

async function showcase(page, base) {
  await page.goto(base + '/design-system', { waitUntil: 'networkidle' });
  await page.locator(`[data-showcase="${marker}"]`).waitFor();
  await page.getByRole('heading', { name: 'Design System', exact: true }).waitFor();
}

async function themeIs(page, theme) {
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
  assert.equal(await page.locator('html').evaluate(element => element.style.colorScheme), theme);
}

async function focused(locator) {
  const element = await locator.elementHandle();
  assert.ok(element, 'Focus target is missing');
  try { await locator.page().waitForFunction(target => target === document.activeElement, element, { timeout: 10000 }); }
  finally { await element.dispose(); }
}

async function settledBackground(locator) {
  return locator.evaluate(async element => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    return getComputedStyle(element).backgroundColor;
  });
}

async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => {
    const host = document.querySelector('.ds-page');
    return { document: document.documentElement.scrollWidth, viewport: innerWidth,
      host: host?.scrollWidth, hostWidth: host?.clientWidth };
  });
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${label}: page overflow ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.hostWidth > 0, `${label}: showcase scroll container missing`);
  assert.ok(dimensions.host <= dimensions.hostWidth + 1, `${label}: showcase overflow`);
}

// Measure rendered colors, including alpha backgrounds, rather than comparing token names.
async function contrast(page, selector, minimum, channel, label) {
  const values = await page.locator(selector).evaluateAll((elements, kind) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      const c = [...ctx.getImageData(0, 0, 1, 1).data]; return [c[0], c[1], c[2], c[3] / 255]; };
    const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
    const background = element => {
      const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.push(node);
      return ancestors.reverse().reduce((color, node) => over(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255, 1]);
    };
    const luminance = color => { const c = color.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
    return elements.filter(element => element.getBoundingClientRect().width > 1 && element.getBoundingClientRect().height > 1).map(element => {
      const css = getComputedStyle(element);
      const bg = background(kind === 'focus' ? element.parentElement : element);
      const source = kind === 'border' ? css.borderTopColor : kind === 'focus' ? css.outlineColor : css.color;
      const fg = over(rgba(source), bg);
      const a = luminance(fg), b = luminance(bg);
      return { text: (element.getAttribute('aria-label') || element.textContent || element.id).trim().slice(0, 70),
        ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground: source,
        background: bg.slice(0, 3), outlineWidth: css.outlineWidth, outlineStyle: css.outlineStyle };
    });
  }, channel);
  assert.ok(values.length, `No rendered elements for ${label}`);
  for (const value of values) {
    assert.ok(value.ratio >= minimum, `${label}: contrast ${value.ratio.toFixed(2)} < ${minimum}: ${JSON.stringify(value)}`);
    if (channel === 'focus') assert.ok(parseFloat(value.outlineWidth) > 0 && value.outlineStyle !== 'none', `${label}: focus outline missing`);
  }
  report.contrast.push({ label, elements: values.length, minimum, lowest: Number(Math.min(...values.map(value => value.ratio)).toFixed(2)) });
}

async function interactions(page, theme, width) {
  const label = `${theme}/${width}`;
  await noOverflow(page, label);
  await page.screenshot({ path: path.join(output, `showcase-${theme}-${width}.png`) });
  const skip = page.getByRole('link', { name: 'Ir para os componentes', exact: true });
  await skip.focus(); await skip.press('Enter');
  await page.waitForFunction(() => location.pathname === '/design-system' && location.hash === '#foundations');
  await focused(page.locator('#foundations'));
  await page.getByRole('navigation', { name: 'Seções do Design System', exact: true })
    .getByRole('link', { name: 'Formulários', exact: true }).click();
  await page.waitForFunction(() => location.pathname === '/design-system' && location.hash === '#forms');
  await focused(page.locator('#forms'));
  const primary = page.getByRole('button', { name: 'Principal', exact: true });
  await primary.click();
  await page.getByText('Ação principal demonstrada.', { exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Desabilitado', exact: true }).isDisabled());
  const busy = page.getByRole('button', { name: 'Salvando exemplo', exact: true });
  assert.ok(await busy.isDisabled()); assert.equal(await busy.getAttribute('aria-busy'), 'true');
  await page.keyboard.press('Tab'); await primary.focus(); await focused(primary);
  await contrast(page, '#buttons button[spButton]:focus', 3, 'focus', `${label} keyboard focus`);
  await page.mouse.move(1, 1);
  const ordinary = await settledBackground(primary);
  await primary.hover();
  assert.notEqual(await settledBackground(primary), ordinary, `${label}: hover background must change`);
  await contrast(page, '#buttons button[spButton]:not(:disabled), #surfaces sp-badge, .ds-muted, .ds-type-caption', 4.5, 'text', `${label} component text`);

  const name = page.locator('#ds-name');
  await page.getByRole('button', { name: 'Validar exemplo', exact: true }).click();
  await page.getByText('Informe um nome para continuar.', { exact: true }).waitFor();
  assert.equal(await name.getAttribute('aria-invalid'), 'true');
  const descriptions = (await name.getAttribute('aria-describedby')).split(/\s+/);
  assert.ok(descriptions.includes('ds-name-hint') && descriptions.includes('ds-name-error'));
  for (const id of descriptions) assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
  assert.equal(await page.getByLabel(/Nome do exemplo/).count(), 1);
  await contrast(page, '#ds-name, #ds-calendar, #ds-invalid', 3, 'border', `${label} field borders`);
  await contrast(page, '.sp-ds-form-field__hint, .sp-ds-form-field__error', 4.5, 'text', `${label} validation text`);
  await page.screenshot({ path: path.join(output, `forms-${theme}-${width}.png`) });
  await name.fill('Planejamento de demonstração');
  await page.getByRole('button', { name: 'Validar exemplo', exact: true }).click();
  await page.locator('#ds-name-error').waitFor({ state: 'detached' });
  await page.getByText('Exemplo validado. Nenhum dado foi enviado.', { exact: true }).waitFor();
  assert.notEqual(await name.getAttribute('aria-invalid'), 'true');
  await page.getByLabel('Calendário de exemplo', { exact: true }).selectOption('shared');
  const checkbox = page.getByRole('checkbox', { name: 'Receber lembretes de exemplo', exact: true });
  await checkbox.uncheck(); assert.equal(await checkbox.isChecked(), false); await checkbox.check();
  assert.ok(await page.locator('#ds-disabled').isDisabled());
  assert.ok(await page.locator('#ds-select-disabled').isDisabled());
  assert.ok(await page.getByRole('checkbox', { name: 'Seleção parcial', exact: true }).evaluate(element => element.indeterminate));

  const menuTrigger = page.getByRole('button', { name: 'Ações do exemplo', exact: true });
  await menuTrigger.focus(); await menuTrigger.press('ArrowDown');
  const firstItem = page.getByRole('menuitem', { name: 'Ver detalhes', exact: true });
  const lastItem = page.getByRole('menuitem', { name: 'Duplicar exemplo', exact: true });
  await focused(firstItem);
  assert.equal(await menuTrigger.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.getByRole('menuitem', { name: 'Arquivar exemplo', exact: true }).isDisabled());
  const menu = page.getByRole('menu', { name: 'Ações do exemplo', exact: true });
  const bounds = await menu.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0, `${label}: dropdown bounds`);
  await page.keyboard.press('End'); await focused(lastItem);
  await page.keyboard.press('ArrowDown'); await focused(firstItem);
  await page.keyboard.press('ArrowUp'); await focused(lastItem);
  await page.keyboard.press('Home'); await focused(firstItem);
  await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' }); await focused(menuTrigger);
  await menuTrigger.press('ArrowUp'); await focused(lastItem); await page.keyboard.press('Enter');
  await page.getByText('Ação demonstrada: Duplicar exemplo.', { exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Menu indisponível', exact: true }).isDisabled());

  const tooltipTrigger = page.getByRole('button', { name: 'Conhecer o tooltip', exact: true });
  await tooltipTrigger.focus();
  const tooltip = page.getByRole('tooltip'); await tooltip.waitFor();
  assert.equal(await tooltipTrigger.getAttribute('aria-describedby'), await tooltip.getAttribute('id'));
  await contrast(page, '[role=tooltip]', 4.5, 'text', `${label} tooltip`);
  await tooltipTrigger.press('Escape'); await tooltip.waitFor({ state: 'detached' });
  await name.focus(); await tooltipTrigger.hover(); await tooltip.waitFor();
  const tooltipBounds = await tooltip.boundingBox();
  assert.ok(tooltipBounds.x >= 0 && tooltipBounds.x + tooltipBounds.width <= width + 1, `${label}: tooltip bounds`);
  await page.mouse.move(tooltipBounds.x + tooltipBounds.width / 2, tooltipBounds.y + tooltipBounds.height / 2);
  await page.waitForTimeout(175); // Exceeds the documented 125ms pointer-transfer hide delay.
  assert.ok(await tooltip.isVisible());
  await page.mouse.move(1, 1); await tooltip.waitFor({ state: 'detached' });

  const opener = page.getByRole('button', { name: 'Abrir modal de exemplo', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Um espaço para decidir', exact: true });
  await dialog.waitFor();
  assert.ok(await dialog.evaluate(element => element.matches(':modal') && element.contains(document.activeElement)));
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  const backgroundTop = await page.locator('.ds-page').evaluate(element => element.scrollTop);
  await page.mouse.move(5, 5); await page.mouse.wheel(0, 300);
  await page.waitForTimeout(175); // Allow the browser compositor to apply the wheel gesture.
  assert.ok(Math.abs(await page.locator('.ds-page').evaluate(element => element.scrollTop) - backgroundTop) < 2,
    `${label}: background scroll container moved while the modal was open`);
  const close = dialog.getByRole('button', { name: 'Fechar diálogo', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Confirmar exemplo', exact: true });
  await confirm.focus(); await page.keyboard.press('Tab'); await focused(close);
  await close.press('Shift+Tab'); await focused(confirm);
  await page.getByLabel('Anotação de exemplo', { exact: true }).fill('Somente demonstração');
  const dialogBounds = await dialog.boundingBox();
  assert.ok(dialogBounds.width <= width && dialogBounds.y >= 0 && dialogBounds.height <= page.viewportSize().height, `${label}: modal bounds`);
  await page.screenshot({ path: path.join(output, `modal-${theme}-${width}.png`) });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); await focused(opener);
  const restoredTop = await page.locator('.ds-page').evaluate(element => element.scrollTop);
  await page.mouse.move(width / 2, 100); await page.mouse.wheel(0, restoredTop > 200 ? -120 : 120);
  await page.waitForTimeout(175);
  assert.ok(Math.abs(await page.locator('.ds-page').evaluate(element => element.scrollTop) - restoredTop) > 20,
    `${label}: background scrolling was not restored after closing the modal`);
  await noOverflow(page, label + ' after interactions');
}

async function checkDevelopment(browser, base) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const { context, page } = await contextFor(browser, { viewport: { width, height: 900 } }, theme);
      try {
        await showcase(page, base); await themeIs(page, theme);
        await interactions(page, theme, width);
        await page.getByRole('button', { name: theme === 'light' ? 'Escuro' : 'Claro', exact: true }).click();
        await themeIs(page, theme === 'light' ? 'dark' : 'light');
        await page.reload({ waitUntil: 'networkidle' }); await themeIs(page, theme === 'light' ? 'dark' : 'light');
        report.development.push({ theme, width, interactions: 'PASS', reload: 'PASS' });
      } finally { await context.close(); }
    }
  }
  const { context, page } = await contextFor(browser, { viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' }, 'system');
  try {
    await showcase(page, base); await themeIs(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await themeIs(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await themeIs(page, 'light');
    const peer = await context.newPage();
    await peer.goto(base + '/design-system', { waitUntil: 'networkidle' });
    await peer.getByRole('button', { name: 'Escuro', exact: true }).click(); await themeIs(page, 'dark');
    await peer.close();
    const animation = await page.locator('sp-loading-state .spinner').first().evaluate(element => getComputedStyle(element).animationName);
    assert.equal(animation, 'none', 'Reduced motion must stop the loading animation');
    assert.equal(await page.getByRole('status').filter({ hasText: 'Carregando seus planos de exemplo…' }).count(), 1);
    report.development.push({ systemTheme: 'PASS', liveSystemChange: 'PASS', crossTabStorage: 'PASS', reducedMotion: 'PASS' });
  } finally { await context.close(); }
}

function noProductionShowcase(root) {
  let checked = 0;
  const walk = directory => { if (!fs.existsSync(directory)) return;
    for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, file.name);
      if (file.isDirectory()) walk(full);
      else if (/\.(?:js|mjs|html)$/.test(file.name)) {
        assert.ok(!fs.readFileSync(full, 'utf8').includes(marker), `Development showcase leaked into production: ${full}`); checked++;
      }
    }
  };
  walk(root); walk(path.join(path.dirname(root), 'server'));
  assert.ok(checked, 'No production JavaScript/HTML artifacts found'); return checked;
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let developmentServer, productionServer;
  try {
    if (!productionOnly) { developmentServer = await serve(developmentRoot); await checkDevelopment(browser, developmentServer.base); }
    if (productionRoot) {
      const artifactsChecked = noProductionShowcase(productionRoot);
      productionServer = await serve(productionRoot);
      const { context, page } = await contextFor(browser);
      try {
        await page.goto(productionServer.base + '/design-system', { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
        assert.equal(await page.locator(`[data-showcase="${marker}"]`).count(), 0);
        assert.ok(new URL(page.url()).pathname.endsWith('/login'), 'Production must follow the existing unauthenticated fallback');
        report.production = { artifactsChecked, showcaseExcluded: true, directNavigation: 'login fallback' };
      } finally { await context.close(); }
    }
    assert.deepEqual(report.unexpectedApiRequests, [], 'The showcase must never call application APIs');
    assert.deepEqual(report.pageErrors, [], 'Unexpected browser runtime errors');
    console.log(JSON.stringify({ result: 'PASS', ...report, output }, null, 2));
  } finally {
    fs.writeFileSync(path.join(output, 'design-system-report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    if (developmentServer) await developmentServer.close();
    if (productionServer) await productionServer.close();
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

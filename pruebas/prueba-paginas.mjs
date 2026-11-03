/**
 * Sitio multipágina: cada página carga por sí sola y marca su enlace activo.
 *
 * Sustituye a la antigua prueba de hash. Para cada página pública y del
 * cliente comprueba, en un navegador real (Playwright), que:
 *   - responde 200, tiene <title>, meta description y un solo <h1>;
 *   - el menú principal muestra las 7 páginas y solo la actual lleva
 *     pf-enlace-activo y aria-current="page";
 *   - la URL no usa anclas y el cuerpo no queda oculto;
 *   - el carrito lateral, su contador y el menú hamburguesa funcionan;
 *   - no hay errores de JavaScript.
 *
 * Ejecutar con:  node pruebas/prueba-paginas.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const rutaModulo = process.env.PW_MODULO || 'playwright';
const modulo = await import(rutaModulo === 'playwright' ? 'playwright' : pathToFileURL(rutaModulo).href);
const { chromium } = modulo.default ?? modulo;

const PUERTO = 5513;
const BASE = process.env.BASE || `http://localhost:${PUERTO}`;
const servidor = spawn(process.execPath, [join(aqui, 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
await new Promise((r) => setTimeout(r, 800));

let fallos = 0;
function comprobar(descripcion, condicion, extra = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}${extra ? ' -> ' + extra : ''}`);
  if (!condicion) fallos += 1;
}

const MENU = ['Inicio', 'Planes', 'Tienda', 'Clases', 'Rutinas', 'Nutrición', 'Contacto'];
const PAGINAS = [
  { ruta: 'index.html', pagina: 'inicio', activo: 'Inicio' },
  { ruta: 'cliente/planes.html', pagina: 'planes', activo: 'Planes' },
  { ruta: 'cliente/tienda.html', pagina: 'tienda', activo: 'Tienda' },
  { ruta: 'cliente/clases.html', pagina: 'clases', activo: 'Clases' },
  { ruta: 'cliente/rutinas.html', pagina: 'rutinas', activo: 'Rutinas' },
  { ruta: 'cliente/nutricion.html', pagina: 'nutricion', activo: 'Nutrición' },
  { ruta: 'cliente/contacto.html', pagina: 'contacto', activo: 'Contacto' },
  { ruta: 'cliente/login.html', pagina: 'login', activo: null },
  { ruta: 'cliente/checkout.html', pagina: 'checkout', activo: null }
];

const navegador = await chromium.launch();

for (const { ruta, pagina: clave, activo } of PAGINAS) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

  // El checkout sin sesión redirige al login: se entra con sesión de prueba.
  if (clave === 'checkout') {
    await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await pagina.evaluate(() => sessionStorage.setItem('usuario', JSON.stringify({ id: 1, nombre: 'Cliente', correo: 'cliente@correo.com', rol: 'cliente' })));
  }

  const respuesta = await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' });
  comprobar(`${ruta}: responde 200`, respuesta?.status() === 200, String(respuesta?.status()));
  comprobar(`${ruta}: data-pagina="${clave}"`, (await pagina.getAttribute('body', 'data-pagina')) === clave);
  comprobar(`${ruta}: tiene <title>`, (await pagina.title()).trim().length > 0, await pagina.title());
  comprobar(`${ruta}: tiene meta description`,
    ((await pagina.getAttribute('meta[name="description"]', 'content')) || '').length > 20);
  comprobar(`${ruta}: un solo h1`, (await pagina.locator('h1').count()) === 1);

  const textos = (await pagina.locator('header .pf-menu-lista a').allInnerTexts()).map((t) => t.trim());
  comprobar(`${ruta}: menú con las 7 páginas`, textos.join('|') === MENU.join('|'), textos.join('|'));
  const hrefs = await pagina.locator('header .pf-menu-lista a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  comprobar(`${ruta}: el menú no usa anclas`, hrefs.every((h) => !h.includes('#')), hrefs.join(', '));

  const activos = (await pagina.locator('header a.pf-enlace-activo').allInnerTexts()).map((t) => t.trim());
  const actuales = (await pagina.locator('header .pf-menu-lista a[aria-current]').evaluateAll((as) =>
    as.map((a) => `${a.textContent.trim()}:${a.getAttribute('aria-current')}`)));
  if (activo) {
    comprobar(`${ruta}: "${activo}" activo con aria-current="page"`,
      activos.join() === activo && actuales.join() === `${activo}:page`, `${activos} / ${actuales}`);
  } else {
    comprobar(`${ruta}: ningún enlace del menú activo`, activos.length === 0 && actuales.length === 0);
  }

  comprobar(`${ruta}: la URL no lleva ancla`, new URL(pagina.url()).hash === '');
  comprobar(`${ruta}: el cuerpo es visible`,
    await pagina.evaluate(() => getComputedStyle(document.body).visibility !== 'hidden'));
  comprobar(`${ruta}: conserva "Ir al contenido principal"`,
    (await pagina.getAttribute('.pf-saltar', 'href')) === '#contenido' && (await pagina.locator('main#contenido').count()) === 1);

  // Carrito lateral y contador.
  comprobar(`${ruta}: contador del carrito presente`, (await pagina.locator('header [data-contador-carrito]').innerText()).trim() === '0');

  // WCAG 2.2 SC 2.5.3: el nombre accesible empieza por el texto visible.
  const nombreCarrito = (await pagina.getAttribute('header [data-abrir-carrito]', 'aria-label')) || '';
  const visibleCarrito = (await pagina.locator('header [data-abrir-carrito] :not([aria-hidden="true"])').allInnerTexts())
    .map((t) => t.trim()).filter(Boolean).join(' ');
  const normalizar = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  comprobar(`${ruta}: el nombre del carrito empieza por su texto visible`,
    normalizar(nombreCarrito).startsWith(normalizar(visibleCarrito)) && nombreCarrito === 'Carrito, 0 productos',
    `visible "${visibleCarrito}" -> nombre "${nombreCarrito}"`);
  const botones = await pagina.locator('main button[aria-label]').evaluateAll((bs) =>
    bs.map((b) => ({ visible: b.innerText.trim(), nombre: b.getAttribute('aria-label') })));
  const malos = botones.filter((b) => b.visible && !normalizar(b.nombre).startsWith(normalizar(b.visible)));
  comprobar(`${ruta}: los botones con aria-label empiezan por su texto visible`, malos.length === 0,
    malos.map((b) => `"${b.visible}" -> "${b.nombre}"`).join(' | ') || `${botones.length} revisados`);
  await pagina.click('header [data-abrir-carrito]');
  await pagina.waitForTimeout(400);
  comprobar(`${ruta}: el carrito lateral se abre`, await pagina.locator('[data-panel-carrito]').isVisible());
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(400);
  comprobar(`${ruta}: Escape cierra el carrito`, await pagina.locator('[data-panel-carrito]').isHidden());

  // Menú hamburguesa en móvil.
  await pagina.setViewportSize({ width: 360, height: 720 });
  comprobar(`${ruta}: en móvil el menú arranca plegado`, await pagina.locator('[data-menu]').isHidden());
  await pagina.click('[data-menu-boton]');
  comprobar(`${ruta}: el botón hamburguesa despliega el menú`,
    (await pagina.locator('[data-menu]').isVisible()) && (await pagina.getAttribute('[data-menu-boton]', 'aria-expanded')) === 'true');
  await pagina.keyboard.press('Escape');
  comprobar(`${ruta}: sin desbordamiento horizontal en móvil`,
    await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  const reales = errores.filter((e) => !e.includes('favicon') && !e.includes('cdn.tailwindcss.com should not be used in production'));
  comprobar(`${ruta}: sin errores de JavaScript`, reales.length === 0, reales.join(' | '));
  await contexto.close();
}

await navegador.close();
console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron' : `\n${fallos} comprobaciones fallaron`);
process.exit(fallos === 0 ? 0 : 1);

/**
 * Prueba de humo en navegador real (Playwright).
 * Ejecutar con:  node pruebas/prueba-navegador.mjs
 * Requiere el proyecto servido en http://localhost:5500
 *
 * Si Playwright está instalado fuera del proyecto, indicar su ruta:
 *   set PW_MODULO=C:\ruta\node_modules\playwright\index.js
 *   node pruebas/prueba-navegador.mjs
 */
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const rutaModulo = process.env.PW_MODULO || 'playwright';
const modulo = await import(rutaModulo === 'playwright' ? 'playwright' : pathToFileURL(rutaModulo).href);
const { chromium } = modulo.default ?? modulo;

const BASE = process.env.BASE || 'http://localhost:5511';
let fallos = 0;

/* Servidor local: la prueba es autocontenida. */
const servidor = spawn(process.execPath, [join(aqui, 'servidor.mjs'), '5511'], {
  stdio: 'ignore',
  detached: false
});
const apagarServidor = () => servidor.kill();
process.on('exit', apagarServidor);
await new Promise((r) => setTimeout(r, 800));

function comprobar(descripcion, condicion, extra = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}${extra ? ' -> ' + extra : ''}`);
  if (!condicion) fallos += 1;
}

/* El panel pinta sus datos de forma asíncrona (Fetch de los JSON e IndexedDB).
   Una espera fija no garantiza que el DOM esté listo: en un runner lento la
   lectura llegaba antes de tiempo y la comprobación fallaba sin motivo. Estas
   utilidades esperan al estado esperado y, si no llega, la comprobación que las
   sigue sigue mostrando el valor real leído para poder diagnosticar. */
const ESPERA_DOM = 20000;

async function esperarEnElDom(condicion, argumento) {
  return pagina
    .waitForFunction(condicion, argumento, { timeout: ESPERA_DOM })
    .then(() => true)
    .catch(() => false);
}

/** Espera a que un elemento muestre exactamente un texto. */
const esperarTexto = (selector, valor) =>
  esperarEnElDom(
    ([sel, esperado]) => document.querySelector(sel)?.textContent.trim() === esperado,
    [selector, valor]
  );

/** Espera a que un conjunto de elementos tenga una cantidad concreta de hijos. */
const esperarCantidad = (selector, cantidad) =>
  esperarEnElDom(([sel, n]) => document.querySelectorAll(sel).length === n, [selector, cantidad]);

/** Espera a que algún elemento del conjunto contenga un texto. */
const esperarTextoEn = (selector, texto) =>
  esperarEnElDom(
    ([sel, t]) => [...document.querySelectorAll(sel)].some((n) => n.textContent.includes(t)),
    [selector, texto]
  );

/** Espera a que un elemento se muestre en pantalla. */
const esperarVisible = (selector) =>
  pagina.locator(selector).first().waitFor({ state: 'visible', timeout: ESPERA_DOM }).then(() => true).catch(() => false);

/** Espera a que el contador del encabezado muestre un valor y lo devuelve. */
async function contadorCarrito(valor) {
  await esperarTexto('[data-contador-carrito]', valor);
  return pagina.locator('[data-contador-carrito]').first().innerText();
}

/* El panel lateral y el modal animan su visibilidad (260 ms). Se espera a que
   termine la transición antes de preguntar por isVisible/isHidden. */
const TRANSICION = 400;
const esperar = () => pagina.waitForTimeout(TRANSICION);
const abrirPanel = async (selector = 'header [data-abrir-carrito]') => {
  await pagina.click(selector);
  await esperar();
};

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();

const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => {
  if (m.type() === 'error') errores.push(`consola: ${m.text()}`);
});

/* ---------- 1. Sitio multipágina: cada sección es su propio archivo ---------- */

/** Fuerza la carga de las imágenes diferidas y devuelve las que no cargaron. */
async function imagenesRotas() {
  await pagina.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager'));
    await Promise.all(
      [...document.images].map((i) =>
        i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })
      )
    );
  });
  return pagina.evaluate(() =>
    [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.getAttribute('src'))
  );
}

await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
const rotasInicio = await imagenesRotas();
comprobar(
  'El h1 del inicio es correcto',
  (await pagina.locator('h1').innerText()).toLowerCase().includes('entrena')
);
comprobar('El inicio ya no contiene las secciones movidas',
  (await pagina.locator('[data-planes], [data-catalogo], [data-clases], [data-niveles], #formulario-contacto, section#nutricion').count()) === 0);
comprobar('El inicio ofrece una tarjeta por cada página',
  (await pagina.locator('main a[href^="cliente/"]').count()) >= 6);
comprobar('No hay imágenes rotas en el inicio', rotasInicio.length === 0, rotasInicio.join(', '));

/* Cada página carga, tiene su título, su h1 y marca su enlace como actual. */
const PAGINAS_SITIO = [
  { ruta: 'index.html', menu: 'Inicio', h1: 'entrena' },
  { ruta: 'cliente/planes.html', menu: 'Planes', h1: 'planes' },
  { ruta: 'cliente/tienda.html', menu: 'Tienda', h1: 'tienda' },
  { ruta: 'cliente/clases.html', menu: 'Clases', h1: 'clases' },
  { ruta: 'cliente/rutinas.html', menu: 'Rutinas', h1: 'rutinas' },
  { ruta: 'cliente/nutricion.html', menu: 'Nutrición', h1: 'nutrición' },
  { ruta: 'cliente/contacto.html', menu: 'Contacto', h1: 'contacto' }
];
for (const { ruta, menu, h1 } of PAGINAS_SITIO) {
  const respuesta = await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' });
  const activos = await pagina.locator('header a.pf-enlace-activo').allInnerTexts();
  const actual = await pagina.locator('header a[aria-current="page"]').allInnerTexts();
  comprobar(`${ruta} responde 200`, respuesta?.status() === 200, String(respuesta?.status()));
  comprobar(`${ruta} tiene un solo h1 con su título`,
    (await pagina.locator('h1').count()) === 1 &&
      (await pagina.locator('h1').innerText()).toLowerCase().includes(h1));
  comprobar(`${ruta} marca "${menu}" como página actual`,
    activos.length === 1 && actual.length === 1 && activos[0].trim() === menu && actual[0].trim() === menu,
    `activos: ${activos.join(', ')} | aria-current: ${actual.join(', ')}`);
  comprobar(`${ruta} no deja la página oculta`,
    await pagina.evaluate(() => getComputedStyle(document.body).visibility !== 'hidden'));
}

/* Los enlaces del menú cargan la página real, sin anclas. */
await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
await pagina.click('header a.pf-enlace:has-text("Clases")');
await pagina.waitForLoadState('networkidle');
comprobar('El menú lleva a cliente/clases.html', new URL(pagina.url()).pathname.endsWith('/cliente/clases.html'), pagina.url());
comprobar('La URL no lleva ancla', new URL(pagina.url()).hash === '');
await pagina.click('header a.pf-enlace:has-text("Contacto")');
await pagina.waitForLoadState('networkidle');
comprobar('Desde cliente/ el menú lleva a contacto.html', new URL(pagina.url()).pathname.endsWith('/cliente/contacto.html'), pagina.url());
await pagina.click('header a.pf-enlace:has-text("Inicio")');
await pagina.waitForLoadState('networkidle');
comprobar('Desde cliente/ "Inicio" vuelve a index.html', new URL(pagina.url()).pathname.endsWith('/index.html'), pagina.url());
await pagina.click('main a:has-text("Ver planes")');
await pagina.waitForLoadState('networkidle');
comprobar('"Ver planes" del inicio abre cliente/planes.html', new URL(pagina.url()).pathname.endsWith('/cliente/planes.html'), pagina.url());

/* Contenido dibujado desde los JSON en cada página. */
await pagina.goto(`${BASE}/cliente/planes.html`, { waitUntil: 'networkidle' });
comprobar('Se pintan 3 planes', (await pagina.locator('[data-planes] article').count()) === 3);
comprobar('Planes incluye "Cómo elegir tu plan"', (await pagina.locator('#titulo-como-contratar').count()) === 1);

await pagina.goto(`${BASE}/cliente/clases.html`, { waitUntil: 'networkidle' });
const rotasClases = await imagenesRotas();
comprobar('Se pintan 2 clases', (await pagina.locator('[data-clases] article').count()) === 2);
comprobar('Se pintan 3 entrenadores', (await pagina.locator('[data-entrenadores] article').count()) === 3);
comprobar('La página de clases no usa ninguna tabla', (await pagina.locator('main table').count()) === 0);
comprobar('Las tarjetas de clase muestran los 5 horarios', (await pagina.locator('[data-clases] .pf-clase-horario').count()) === 5);
comprobar('No hay imágenes rotas en clases', rotasClases.length === 0, rotasClases.join(', '));

await pagina.goto(`${BASE}/cliente/rutinas.html`, { waitUntil: 'networkidle' });
const rotasRutinas = await imagenesRotas();
comprobar('Se pintan 6 servicios', (await pagina.locator('[data-servicios] article').count()) === 6);
comprobar('Se pintan 3 niveles de rutina', (await pagina.locator('[data-niveles] li').count()) === 3);
comprobar('No hay imágenes rotas en rutinas', rotasRutinas.length === 0, rotasRutinas.join(', '));

await pagina.goto(`${BASE}/cliente/contacto.html`, { waitUntil: 'networkidle' });
comprobar('Se muestran 3 horarios del gimnasio', (await pagina.locator('[data-gimnasio-horarios] li').count()) === 3);
await pagina.click('#formulario-contacto button[type="submit"]');
await pagina.waitForTimeout(200);
comprobar('El formulario de contacto vacío marca campos inválidos',
  (await pagina.locator('#formulario-contacto [aria-invalid="true"]').count()) >= 4);
comprobar('El foco salta al primer campo inválido', await pagina.evaluate(() => document.activeElement?.id === 'nombre'));
await pagina.fill('#nombre', 'Ana Pérez');
await pagina.fill('#correo', 'ana@correo.com');
await pagina.fill('#telefono', '1234');
await pagina.fill('#mensaje', 'Quiero información de los planes.');
await pagina.click('#formulario-contacto button[type="submit"]');
await pagina.waitForTimeout(200);
comprobar('Un teléfono inválido se rechaza', (await pagina.getAttribute('#telefono', 'aria-invalid')) === 'true');
await pagina.fill('#telefono', '0991234567');
await pagina.click('#formulario-contacto button[type="submit"]');
await esperarTextoEn('#mensaje-contacto', 'Mensaje enviado');
comprobar('El formulario de contacto válido se envía',
  (await pagina.locator('#mensaje-contacto').innerText()).includes('Mensaje enviado'));
comprobar('El mensaje queda guardado en localStorage',
  await pagina.evaluate(() => (JSON.parse(localStorage.getItem('mensajesContacto') || '[]')).length >= 1));

/* ---------- 2. Productos por categorías (cliente/tienda.html) ---------- */
await pagina.goto(`${BASE}/cliente/tienda.html`, { waitUntil: 'networkidle' });
comprobar('El catálogo trae 10 productos del JSON', (await pagina.locator('[data-catalogo] article').count()) === 10);
comprobar('La tienda ya no depende de filtros', (await pagina.locator('#filtro-categoria, [data-filtrar], [data-limpiar-filtros], #busqueda-productos').count()) === 0);
const seccionesTienda = pagina.locator('[data-catalogo] > section.pf-tienda-categoria');
comprobar('La tienda agrupa los productos en 3 categorías', (await seccionesTienda.count()) === 3);
comprobar('La primera categoría es Suplementos con 4 productos', (await seccionesTienda.nth(0).locator('article').count()) === 4);
comprobar('La segunda categoría es Ropa con 3 productos', (await seccionesTienda.nth(1).locator('article').count()) === 3);
comprobar('La tercera categoría es Accesorios con 3 productos', (await seccionesTienda.nth(2).locator('article').count()) === 3);
comprobar('Los títulos de categoría usan h2 bajo el h1 Tienda', (await pagina.locator('[data-catalogo] h2.pf-tienda-titulo').count()) === 3);
/* `innerText` devuelve el texto ya transformado por CSS, y los títulos de
   categoría van en mayúsculas (`text-transform`), así que se comparan en
   minúsculas. */
const titulosCategoria = (await seccionesTienda.locator('h2.pf-tienda-titulo').allInnerTexts())
  .map((t) => t.trim().toLowerCase());
comprobar(
  'Las categorías aparecen en el orden del JSON',
  titulosCategoria.join(' | ') === 'suplementos | ropa | accesorios',
  titulosCategoria.join(' | ')
);

/* Los totales del carrito se calculan con los precios que hay pintados en el
   catálogo: si el JSON cambia, la prueba sigue siendo válida. */
const PRECIOS = await pagina
  .locator('[data-catalogo] article p.text-pf-amarillo')
  .allInnerTexts()
  .then((textos) => textos.map((t) => Number(t.replace(/[^\d.]/g, ''))));
const dinero = (valor) => `$${valor.toFixed(2)}`;
comprobar('Se leen los precios de las tarjetas', PRECIOS.length === 10 && PRECIOS.every((p) => p > 0));
const totalDos = PRECIOS[0] + PRECIOS[1];

/* ---------- 3. Carrito lateral (drawer, sin sesión) ---------- */
await pagina.locator('[data-catalogo] article button[data-accion="agregar"]').nth(0).click();
await pagina.locator('[data-catalogo] article button[data-accion="agregar"]').nth(1).click();
await pagina.waitForTimeout(200);
comprobar('El contador del carrito muestra 2', (await contadorCarrito('2')));
comprobar('Agregar al carrito no exige sesión', pagina.url().includes('tienda.html'));
comprobar('El panel lateral está inyectado', (await pagina.locator('[data-panel-carrito]').count()) === 1);
comprobar('El panel lateral arranca cerrado', await pagina.locator('[data-panel-carrito]').isHidden());

await abrirPanel();
comprobar('El botón del encabezado abre el panel', await pagina.locator('[data-panel-carrito]').isVisible());
comprobar('La capa oscura se muestra con el panel', await pagina.locator('[data-capa-carrito]').isVisible());
comprobar('El botón informa el panel desplegado', (await pagina.getAttribute('header [data-abrir-carrito]', 'aria-expanded')) === 'true');
comprobar('El panel lista 2 productos', (await pagina.locator('[data-panel-lineas] li').count()) === 2);
comprobar('El subtotal del panel es la suma de los dos productos', (await pagina.locator('[data-panel-subtotal]').innerText()) === dinero(totalDos), dinero(totalDos));
comprobar('El total del panel es la suma de los dos productos', (await pagina.locator('[data-panel-total]').innerText()) === dinero(totalDos), dinero(totalDos));
comprobar('El panel ofrece finalizar compra', await pagina.locator('[data-panel-finalizar]').isVisible());
comprobar('El panel ofrece continuar comprando', await pagina.locator('[data-panel-continuar]').isVisible());
comprobar(
  'El panel es un diálogo modal accesible',
  (await pagina.getAttribute('[data-panel-carrito]', 'aria-modal')) === 'true' &&
    (await pagina.getAttribute('[data-panel-carrito]', 'role')) === 'dialog'
);

/* Foco del diálogo (WCAG 2.1.2, 2.4.3 y 2.4.7): al abrirse el foco entra en el
   panel, Tab da la vuelta dentro sin llegar a la página de fondo y al cerrarlo
   el foco regresa al botón que lo abrió. */
const FOCALIZABLES = "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";
const limitesPanel = () =>
  pagina.evaluate((selector) => {
    const panel = document.querySelector('[data-panel-carrito]');
    const focusables = [...panel.querySelectorAll(selector)].filter(
      (nodo) => nodo.offsetParent !== null || nodo === document.activeElement
    );
    return {
      total: focusables.length,
      dentro: panel.contains(document.activeElement),
      activoEsUltimo: focusables.length > 0 && document.activeElement === focusables[focusables.length - 1],
      activoEsPrimero: focusables.length > 0 && document.activeElement === focusables[0]
    };
  }, FOCALIZABLES);
const enfocarExtremo = (cual) =>
  pagina.evaluate(
    ([selector, extremo]) => {
      const panel = document.querySelector('[data-panel-carrito]');
      const focusables = [...panel.querySelectorAll(selector)].filter(
        (nodo) => nodo.offsetParent !== null || nodo === document.activeElement
      );
      const nodo = extremo === 'ultimo' ? focusables[focusables.length - 1] : focusables[0];
      nodo?.focus();
    },
    [FOCALIZABLES, cual]
  );

/* El foco entra tras la transición de visibilidad, así que se espera a que
   llegue en lugar de dar por hecho que ya está dentro. */
const esperarFocoEnPanel = async () => {
  try {
    await pagina.waitForFunction(
      () => Boolean(document.querySelector('[data-panel-carrito]')?.contains(document.activeElement)),
      null,
      { timeout: 2000 }
    );
    return true;
  } catch {
    return false;
  }
};

let limites = await limitesPanel();
comprobar('Al abrir el panel el foco entra en el diálogo', (await esperarFocoEnPanel()) && limites.dentro);
limites = await limitesPanel();

for (let paso = 0; paso < limites.total + 3; paso += 1) {
  await pagina.keyboard.press('Tab');
  limites = await limitesPanel();
  if (!limites.dentro) break;
}
comprobar(`Tab recorre los ${limites.total} controles del panel sin salir de él`, limites.dentro, JSON.stringify(limites));

await enfocarExtremo('ultimo');
limites = await limitesPanel();
comprobar('Se puede enfocar el último control del panel', limites.activoEsUltimo);
await pagina.keyboard.press('Tab');
limites = await limitesPanel();
comprobar('Tab en el último control vuelve al primero sin salir del diálogo', limites.activoEsPrimero && limites.dentro);

await enfocarExtremo('primero');
await pagina.keyboard.press('Shift+Tab');
limites = await limitesPanel();
comprobar('Shift+Tab en el primer control vuelve al último sin salir del diálogo', limites.activoEsUltimo && limites.dentro);

await pagina.click('[data-panel-lineas] li:first-child [data-sumar]');
await pagina.waitForTimeout(200);
comprobar('El botón + sube la cantidad en el panel', (await pagina.locator('[data-panel-subtotal]').innerText()) === dinero(totalDos + PRECIOS[0]), dinero(totalDos + PRECIOS[0]));
await pagina.click('[data-panel-lineas] li:first-child [data-restar]');
await pagina.waitForTimeout(200);
comprobar('El botón − baja la cantidad en el panel', (await pagina.locator('[data-panel-subtotal]').innerText()) === dinero(totalDos), dinero(totalDos));

await pagina.keyboard.press('Escape');
await esperar();
comprobar('Escape cierra el panel lateral', await pagina.locator('[data-panel-carrito]').isHidden());
comprobar(
  'Al cerrar el panel el foco vuelve al botón que lo abrió',
  await pagina.evaluate(() => document.activeElement === document.querySelector('header [data-abrir-carrito]'))
);

await abrirPanel();
await pagina.click('[data-capa-carrito]', { position: { x: 10, y: 400 } });
await esperar();
comprobar('La capa oscura también cierra el panel', await pagina.locator('[data-panel-carrito]').isHidden());

await abrirPanel();
await pagina.click('[data-panel-lineas] li:first-child [data-quitar]');
await pagina.waitForTimeout(200);
comprobar('Quitar un producto lo elimina del panel', (await pagina.locator('[data-panel-lineas] li').count()) === 1);
await pagina.click('[data-panel-vaciar]');
await pagina.waitForTimeout(200);
comprobar('Vaciar el panel deja el carrito vacío', (await pagina.locator('[data-panel-lineas] li').count()) === 0);
comprobar('El panel avisa que el carrito está vacío', await pagina.locator('[data-panel-vacio-state]').isVisible());
comprobar('El contador del encabezado vuelve a 0', (await contadorCarrito('0')));

await pagina.click('[data-panel-finalizar]');
await pagina.waitForTimeout(200);
comprobar('Finalizar con carrito vacío muestra un aviso', (await pagina.locator('[data-aviso]').innerText()).includes('Agrega productos'));

/* "Continuar comprando" cierra el panel y permite seguir comprando. */
await pagina.click('[data-panel-continuar]');
await esperar();
comprobar('Continuar comprando cierra el panel', await pagina.locator('[data-panel-carrito]').isHidden());

/* El carrito se conserva al recargar y el panel sigue disponible en otra página. */
await pagina.locator('[data-catalogo] article button[data-accion="agregar"]').nth(0).click();
await pagina.waitForTimeout(200);
await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
comprobar('El carrito sobrevive al cambio de página', (await contadorCarrito('1')));
for (const otra of ['cliente/clases.html', 'cliente/rutinas.html', 'cliente/contacto.html']) {
  await pagina.goto(`${BASE}/${otra}`, { waitUntil: 'networkidle' });
  comprobar(`El contador del carrito se mantiene en ${otra}`, (await contadorCarrito('1')) === '1');
  await abrirPanel();
  comprobar(`El panel lateral se abre en ${otra}`, await pagina.locator('[data-panel-carrito]').isVisible());
  await pagina.keyboard.press('Escape');
  await esperar();
}
await pagina.goto(`${BASE}/cliente/planes.html`, { waitUntil: 'networkidle' });
await abrirPanel();
comprobar('El panel se puede abrir desde la página de planes', await pagina.locator('[data-panel-carrito]').isVisible());
await pagina.click('[data-panel-vaciar]');
await esperar();
comprobar('El carrito queda limpio para el flujo de planes', (await contadorCarrito('0')));

/* ---------- 4. Flujo de plan: al carrito y login al finalizar ---------- */
// El panel quedó abierto tras vaciar: se cierra antes de operar con los planes.
await pagina.keyboard.press('Escape');
await esperar();
comprobar('El carrito arranca vacío para el flujo de plan', (await contadorCarrito('0')));

await pagina.click('article[data-plan="1"] button[data-accion="elegir-plan"]');
await esperar();
comprobar('Elegir plan no exige sesión', pagina.url().includes('planes.html'));
comprobar('Elegir plan abre el panel lateral', await pagina.locator('[data-panel-carrito]').isVisible());
comprobar('El panel lista el plan mensual', (await pagina.locator('[data-panel-lineas] li:first-child').innerText()).includes('Plan mensual'));
comprobar('El total del plan individual es $35.00', (await pagina.locator('[data-panel-total]').innerText()) === '$35.00');

await pagina.click('[data-panel-finalizar]');
await esperar();
comprobar('Sin sesión, finalizar abre el modal de acceso', await pagina.locator('[data-modal-acceso]').isVisible());
comprobar('El plan se conserva mientras se inicia sesión', (await pagina.locator('[data-panel-lineas] li').count()) === 1);

await pagina.fill('#acceso-correo', 'cliente@planetafitness.ec');
await pagina.fill('#acceso-contrasena', 'cliente123');
await pagina.click('[data-formulario-acceso] button[type="submit"]');
await pagina.waitForURL(/checkout\.html/, { timeout: 20000 });
comprobar('Tras iniciar sesión el plan llega al checkout', pagina.url().includes('checkout.html'));
await esperarCantidad('[data-checkout-resumen] li', 1);
comprobar('El checkout lista 1 línea', (await pagina.locator('[data-checkout-resumen] li').count()) === 1);
comprobar('El checkout suma $35.00', (await pagina.locator('[data-checkout-total]').innerText()) === '$35.00');

await pagina.fill('#nombre', 'Ana Pérez');
await pagina.fill('#telefono', '0991234567');
await pagina.click('#formulario-checkout button[type="submit"]');
await esperarVisible('[data-checkout-confirmacion]');
comprobar('El plan se confirma', await pagina.locator('[data-checkout-confirmacion]').isVisible());
comprobar(
  'El plan comprado queda como suscripción del cliente',
  await pagina.evaluate(() => Boolean(localStorage.getItem('suscripcion-cli-001')))
);
comprobar('El carrito se vacía tras confirmar el plan', (await contadorCarrito('0')));

// El pedido del plan se limpia para no confundir el siguiente flujo de compra.
await pagina.evaluate(
  () =>
    new Promise((resolve) => {
      localStorage.removeItem('pedidos');
      const r = indexedDB.open('PlanetaFitnessDB');
      r.onsuccess = () => {
        const t = r.result.transaction('pedidos', 'readwrite');
        t.objectStore('pedidos').clear();
        t.oncomplete = () => resolve(true);
        t.onerror = () => resolve(false);
      };
      r.onerror = () => resolve(false);
    })
);

/* ---------- 5. Validación de formularios ---------- */
await pagina.goto(`${BASE}/cliente/nutricion.html`, { waitUntil: 'networkidle' });
await pagina.fill('#cedula', '123');
await pagina.fill('#nombre', 'Ana Pérez');
await pagina.fill('#telefono', '0991234567');
await pagina.fill('#correo', 'ana@correo.com');
await pagina.selectOption('#motivo', 'Evaluación');
await pagina.fill('#fecha', '2020-01-01');
await pagina.click('#formulario-nutricion button[type="submit"]');
await pagina.waitForTimeout(300);
comprobar('La cédula inválida se marca con aria-invalid', (await pagina.getAttribute('#cedula', 'aria-invalid')) === 'true');
comprobar('La fecha pasada se marca con aria-invalid', (await pagina.getAttribute('#fecha', 'aria-invalid')) === 'true');
comprobar('Existe un mensaje de error visible', await pagina.locator('#err-cedula').isVisible());

await pagina.fill('#cedula', '1712345678');
const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
await pagina.fill('#fecha', manana);
await pagina.fill('#hora', '10:00');
await pagina.click('#formulario-nutricion button[type="submit"]');
await pagina.waitForTimeout(500);
comprobar('La cita válida se registra', (await pagina.locator('#mensaje-nutricion').innerText()).includes('Cita solicitada'));
comprobar(
  'La cita queda en localStorage',
  await pagina.evaluate(() => JSON.parse(localStorage.getItem('citasNutricion') || '[]').length === 1)
);

/* ---------- 6. Registro local y inicio de sesión ---------- */
await pagina.goto(`${BASE}/cliente/login.html`, { waitUntil: 'networkidle' });
await pagina.fill('#nombre-registro', 'Luis registered');
await pagina.fill('#cedula-registro', '1712345679');
await pagina.fill('#telefono-registro', '0991112223');
await pagina.fill('#correo-registro', 'luis.registro@correo.com');
await pagina.selectOption('#nivel', 'Intermedio');
await pagina.fill('#contrasena-registro', 'clave1234');
await pagina.fill('#confirmar', 'clave1234');
await pagina.click('#formulario-registro button[type="submit"]');
await pagina.waitForTimeout(400);
comprobar(
  'El registro local confirma el alta',
  (await pagina.locator('#mensaje-registro').innerText()).includes('Registro creado')
);

await pagina.fill('#correo', 'luis.registro@correo.com');
await pagina.fill('#contrasena', 'clave1234');
await pagina.click('#formulario-login button[type="submit"]');
await pagina.waitForTimeout(1200);
comprobar('La cuenta recién registrada puede iniciar sesión', pagina.url().includes('index.html'));
comprobar(
  'La sesión guarda el nombre del nuevo cliente',
  await pagina.evaluate(() => JSON.parse(sessionStorage.getItem('usuario') || 'null')?.nombre === 'Luis registered')
);
comprobar(
  'La contraseña se guarda como huella y no en texto plano',
  await pagina.evaluate(() =>
    [localStorage, sessionStorage].every(
      (almacen) => !JSON.stringify(almacen).includes('clave1234')
    )
  )
);

/* ---------- 6 bis. Flujo de compra: carrito, modal de acceso y checkout ---------- */
await pagina.goto(`${BASE}/cliente/tienda.html`, { waitUntil: 'networkidle' });
await pagina.locator('[data-catalogo] article button[data-accion="agregar"]').nth(0).click();
await pagina.locator('[data-catalogo] article button[data-accion="agregar"]').nth(1).click();
await pagina.waitForTimeout(200);

// El checkout exige sesión: primero se cierra la sesión activa.
await pagina.evaluate(() => sessionStorage.clear());
await pagina.reload({ waitUntil: 'networkidle' });
await abrirPanel();
comprobar('El carrito conserva los productos sin sesión', (await pagina.locator('[data-panel-lineas] li').count()) === 2);
await pagina.click('[data-panel-finalizar]');
await esperar();
comprobar('Sin sesión se abre el modal de acceso', await pagina.locator('[data-modal-acceso]').isVisible());
comprobar('El modal explica que el carrito se conserva', (await pagina.locator('[data-modal-acceso]').innerText()).includes('Tu carrito se conserva'));
comprobar('El modal bloquea la página con aria-modal', (await pagina.getAttribute('[data-modal-acceso]', 'aria-modal')) === 'true');
comprobar(
  'El carrito sigue intacto mientras se inicia sesión',
  (await pagina.locator('[data-panel-lineas] li').count()) === 2
);

await pagina.fill('#acceso-correo', 'cliente@planetafitness.ec');
await pagina.fill('#acceso-contrasena', 'claveincorrecta');
await pagina.click('[data-formulario-acceso] button[type="submit"]');
await pagina.waitForTimeout(400);
comprobar('El modal avisa si la contraseña falla', (await pagina.locator('[data-mensaje-acceso]').innerText()).length > 0);

await pagina.fill('#acceso-contrasena', 'cliente123');
await pagina.click('[data-formulario-acceso] button[type="submit"]');
await pagina.waitForURL(/checkout\.html/, { timeout: 20000 });
comprobar('Tras iniciar sesión el flujo llega al checkout', pagina.url().includes('checkout.html'));
await esperarCantidad('[data-checkout-resumen] li', 2);
comprobar('El checkout conserva los 2 productos', (await pagina.locator('[data-checkout-resumen] li').count()) === 2);
comprobar('El checkout muestra el total de los dos productos', (await pagina.locator('[data-checkout-total]').innerText()) === dinero(totalDos), dinero(totalDos));
comprobar('El checkout autocompleta el correo de la sesión', (await pagina.inputValue('#correo')) === 'cliente@planetafitness.ec');

await pagina.click('#formulario-checkout button[type="submit"]');
await pagina.waitForTimeout(500);
comprobar('El checkout pide el teléfono faltante', (await pagina.getAttribute('#telefono', 'aria-invalid')) === 'true');
comprobar('El checkout no confirma con datos incompletos', await pagina.locator('[data-checkout-confirmacion]').isHidden());

await pagina.fill('#nombre', 'Ana Pérez');
await pagina.fill('#telefono', '0991234567');
await pagina.click('#formulario-checkout button[type="submit"]');
await esperarVisible('[data-checkout-confirmacion]');
comprobar('El pedido se confirma', await pagina.locator('[data-checkout-confirmacion]').isVisible());
comprobar('La confirmación indica el punto de retiro', (await pagina.locator('[data-checkout-confirmacion]').innerText()).includes('Avenida San Rio de Janeiro y Panamá'));
await esperarCantidad('[data-confirmacion-resumen] li', 4);
comprobar('La confirmación muestra el código del pedido', (await pagina.locator('[data-confirmacion-resumen] li').count()) === 4);
comprobar(
  'El pedido quedó guardado en localStorage',
  await pagina.evaluate(() => JSON.parse(localStorage.getItem('pedidos') || '[]').length === 1)
);
comprobar('El carrito se vacía tras confirmar', (await contadorCarrito('0')));
comprobar(
  'El pedido también quedó en IndexedDB',
  await pagina.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('PlanetaFitnessDB');
        r.onsuccess = () => {
          const t = r.result.transaction('pedidos', 'readonly');
          const p = t.objectStore('pedidos').count();
          p.onsuccess = () => resolve(p.result === 1);
          p.onerror = () => resolve(false);
        };
        r.onerror = () => resolve(false);
      })
  )
);

await pagina.goto(`${BASE}/cliente/checkout.html`, { waitUntil: 'networkidle' });
await esperarVisible('[data-checkout-vacio]');
comprobar('El checkout con carrito vacío ofrece la tienda', await pagina.locator('[data-checkout-vacio]').isVisible());

// El checkout no debe abrirse sin sesión aunque se escriba la URL.
await pagina.evaluate(() => sessionStorage.clear());
await pagina.goto(`${BASE}/cliente/checkout.html`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(600);
comprobar('El checkout sin sesión devuelve al login', pagina.url().includes('login.html'));

/* ---------- 7. Cookies y aviso ---------- */
comprobar('Existe la cookie de última actualización', await pagina.evaluate(() => document.cookie.includes('ultimaActualizacion')));

/* El aviso se mide en un contexto aparte: `addInitScript` no se puede quitar y
   la marca de "ya se vio" tiene que sobrevivir a cada recarga. Se cuenta si el
   aviso llegó a pintarse alguna vez, no solo si quedó oculto al final: antes
   venía visible en el HTML y `js/app.js` lo escondía después, de modo que en
   cada recarga aparecía un instante aunque la aceptación ya estuviera guardada. */
const contextoCookies = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const paginaCookies = await contextoCookies.newPage();
await paginaCookies.addInitScript(() => {
  window.__avisoPintado = 0;
  const revisar = () => {
    const n = document.querySelector('[data-aviso-cookies]');
    if (!n) return;
    const caja = n.getBoundingClientRect();
    const estilo = getComputedStyle(n);
    if (caja.height > 0 && caja.width > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none') {
      window.__avisoPintado += 1;
    }
  };
  const bucle = () => {
    revisar();
    requestAnimationFrame(bucle);
  };
  requestAnimationFrame(bucle);
});

/* Primera visita: el aviso se muestra. */
await paginaCookies.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
comprobar('En la primera visita el aviso de cookies se muestra',
  await paginaCookies.locator('[data-aviso-cookies]').isVisible());
comprobar('En la primera visita no hay cookie de aceptación',
  !(await contextoCookies.cookies(BASE)).some((c) => c.name === 'pf_aviso_cookies'));

/* «Entendido»: se cierra y queda guardado. */
await paginaCookies.click('[data-aceptar-cookies]');
await paginaCookies.waitForTimeout(200);
comprobar('El aviso de cookies se puede cerrar',
  await paginaCookies.evaluate(() => document.cookie.includes('pf_aviso_cookies=aceptado')));
const cookieAceptacion = (await contextoCookies.cookies(BASE)).find((c) => c.name === 'pf_aviso_cookies');
comprobar('La cookie de aceptación se guarda con path=/ y 180 días',
  !!cookieAceptacion && cookieAceptacion.path === '/' &&
    cookieAceptacion.expires * 1000 - Date.now() > 170 * 24 * 60 * 60 * 1000,
  JSON.stringify(cookieAceptacion && { path: cookieAceptacion.path, sameSite: cookieAceptacion.sameSite }));

/* Recargas: no debe volver a pintarse ni a mostrarse. */
for (const intento of [1, 2]) {
  await paginaCookies.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const pintado = await paginaCookies.evaluate(() => window.__avisoPintado);
  comprobar(`Tras recargar (${intento}) el aviso no vuelve a pintarse`, pintado === 0, `fotogramas pintados: ${pintado}`);
  comprobar(`Tras recargar (${intento}) el aviso sigue oculto`,
    await paginaCookies.locator('[data-aviso-cookies]').isHidden());
}

/* La aceptación es del sitio completo, no de una página: sirve para todas. */
for (const otra of ['cliente/planes.html', 'cliente/tienda.html', 'cliente/clases.html', 'cliente/rutinas.html', 'cliente/contacto.html', 'cliente/login.html', 'cliente/checkout.html', 'cliente/nutricion.html']) {
  await paginaCookies.goto(`${BASE}/${otra}`, { waitUntil: 'networkidle' });
  const pintado = await paginaCookies.evaluate(() => window.__avisoPintado);
  comprobar(`El aviso no reaparece en ${otra}`, pintado === 0 && await paginaCookies.locator('[data-aviso-cookies]').isHidden(),
    `fotogramas pintados: ${pintado}`);
}
await contextoCookies.close();

/* ---------- 7. IndexedDB ---------- */
comprobar(
  'IndexedDB guardó el catálogo',
  await pagina.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('PlanetaFitnessDB');
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction('productos', 'readonly');
          const p = t.objectStore('productos').count();
          p.onsuccess = () => resolve(p.result === 10);
          p.onerror = () => resolve(false);
        };
        r.onerror = () => resolve(false);
      })
  )
);

/* ---------- 8. Panel administrativo ---------- */
await pagina.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
comprobar('El dashboard redirige al login sin sesión', pagina.url().includes('login.html'));

await pagina.fill('#correo', 'cliente@planetafitness.ec');
await pagina.fill('#contrasena', 'cliente123');
await pagina.click('#formulario-login-admin button[type="submit"]');
await pagina.waitForTimeout(400);
comprobar('Una cuenta de cliente no entra al dashboard', pagina.url().includes('login.html') && (await pagina.locator('#mensaje-login-admin').innerText()).includes('cliente'));

await pagina.fill('#correo', 'admin@planetafitness.ec');
await pagina.fill('#contrasena', 'admin123');
await pagina.click('#formulario-login-admin button[type="submit"]');
await pagina.waitForURL(/admin\/index\.html/, { timeout: 20000 });
comprobar('El administrador entra al dashboard', pagina.url().includes('index.html'));
// El resumen del dashboard se puebla de forma asíncrona con los cuatro JSON y
// con IndexedDB: se espera a que los indicadores dejen su valor de arranque.
await esperarTexto('[data-total-productos]', '10');
comprobar(
  'El total de productos es 10',
  (await pagina.locator('[data-total-productos]').innerText()) === '10',
  await pagina.locator('[data-total-productos]').innerText()
);
await esperarCantidad('[data-tabla-citas] tbody tr', 1);
comprobar('Las citas registradas se listan', (await pagina.locator('[data-tabla-citas] tbody tr').count()) === 1);

await pagina.goto(`${BASE}/admin/productos.html`, { waitUntil: 'networkidle' });
await esperarCantidad('[data-tabla-productos] tr', 10);
comprobar('La tabla de productos lista 10 filas', (await pagina.locator('[data-tabla-productos] tr').count()) === 10);
await pagina.click('[data-tabla-productos] tr:first-child [data-editar]');
await pagina.fill('#precio', '48');
await pagina.click('#formulario-producto button[type="submit"]');
await esperarTextoEn('[data-tabla-productos] tr:first-child', '48.00');
comprobar('El producto editado muestra el precio nuevo', (await pagina.locator('[data-tabla-productos] tr:first-child').innerText()).includes('48.00'));

await pagina.goto(`${BASE}/cliente/tienda.html`, { waitUntil: 'networkidle' });
await esperarTextoEn('[data-catalogo]', '$48.00');
comprobar('El sitio público ve el cambio del administrador', (await pagina.locator('[data-catalogo]').innerText()).includes('$48.00'));

/* ---------- 8 bis. Alta de un producto desde el panel ---------- */
await pagina.goto(`${BASE}/admin/productos.html`, { waitUntil: 'networkidle' });
await pagina.click('[data-nuevo-producto]');
await pagina.fill('#nombre', 'Cinturon de levante');
await pagina.fill('#categoria', 'Accesorios');
await pagina.fill('#precio', '35');
await pagina.fill('#descripcion', 'Cinturon de cuero para pesos muertos usado en el area de pesas.');
await pagina.click('#formulario-producto button[type="submit"]');
await esperarCantidad('[data-tabla-productos] tr', 11);
comprobar('El producto nuevo aparece en la tabla', (await pagina.locator('[data-tabla-productos] tr').count()) === 11);
comprobar(
  'El producto nuevo usa una imagen que existe',
  await pagina.evaluate(async () => {
    const productos = await new Promise((resolver) => {
      const r = indexedDB.open('PlanetaFitnessDB');
      r.onsuccess = () => {
        const t = r.result.transaction('productos', 'readonly');
        const p = t.objectStore('productos').getAll();
        p.onsuccess = () => resolver(p.result);
        p.onerror = () => resolver([]);
      };
      r.onerror = () => resolver([]);
    });
    const nuevo = productos.find((p) => p.nombre === 'Cinturon de levante');
    if (!nuevo) return false;
    const respuesta = await fetch(new URL(nuevo.imagen, new URL('/', location.href)).href);
    return respuesta.ok;
  })
);

/* ---------- 9. Accesibilidad básica ---------- */
await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
comprobar('Solo hay un h1', (await pagina.locator('h1').count()) === 1);
comprobar('Las imágenes informativas tienen alt', (await pagina.locator('img:not([alt])').count()) === 0);
comprobar('El enlace de salto existe', (await pagina.locator('.pf-saltar').count()) === 1);

// Navegación por teclado: el enlace de salto recibe el foco y se muestra.
await pagina.keyboard.press('Tab');
await pagina.waitForTimeout(400); // el enlace se desliza con una transición CSS
const focoVisible = await pagina.evaluate(() => {
  const activo = document.activeElement;
  return activo.classList.contains('pf-saltar') && activo.getBoundingClientRect().top >= 0;
});
comprobar('El enlace de salto recibe el foco y se hace visible', focoVisible);

/* ---------- 10. Responsive ---------- */
await pagina.setViewportSize({ width: 1280, height: 900 });
await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
comprobar('En escritorio el menú principal está visible', await pagina.locator('[data-menu]').isVisible());
comprobar('En escritorio se oculta el botón de menú', await pagina.locator('[data-menu-boton]').isHidden());
await pagina.evaluate(() => window.scrollTo(0, 1200));
await pagina.waitForTimeout(400);
comprobar('El encabezado sigue fijo al hacer scroll', Math.abs(await pagina.locator('.pf-encabezado').evaluate((h) => h.getBoundingClientRect().top)) <= 1);
comprobar('El encabezado reacciona al hacer scroll', (await pagina.getAttribute('.pf-encabezado', 'data-fijo')) === 'true');

await pagina.setViewportSize({ width: 360, height: 720 });
await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
comprobar('En móvil el menú arranca plegado', await pagina.locator('[data-menu]').isHidden());
await pagina.click('[data-menu-boton]');
comprobar('El botón despliega el menú en móvil', await pagina.locator('[data-menu]').isVisible());
comprobar('El botón informa el estado desplegado', (await pagina.getAttribute('[data-menu-boton]', 'aria-expanded')) === 'true');
const cajaMenu = await pagina.locator('[data-menu]').boundingBox();
const altoVista = await pagina.evaluate(() => window.innerHeight);
comprobar('El menú móvil es un panel flotante', (await pagina.locator('[data-menu]').evaluate((m) => getComputedStyle(m).position)) === 'absolute');
comprobar('El menú móvil es compacto y no ocupa toda la pantalla', cajaMenu.height < altoVista - 40 && cajaMenu.width < 360);
comprobar('Abrir el menú no empuja ni bloquea el contenido', !(await pagina.evaluate(() => document.body.classList.contains('pf-bloquea-scroll'))));
await pagina.click('[data-menu-boton]');
comprobar('El botón vuelve a plegar el menú', await pagina.locator('[data-menu]').isHidden());

// El overlay móvil también se cierra con Escape y al elegir una sección.
await pagina.click('[data-menu-boton]');
comprobar('El menú se reabre para probar el cierre', await pagina.locator('[data-menu]').isVisible());
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(200);
comprobar('Escape cierra el menú móvil', await pagina.locator('[data-menu]').isHidden());
await pagina.click('[data-menu-boton]');
await pagina.click('[data-menu] a[href="cliente/planes.html"]');
await pagina.waitForLoadState('networkidle');
comprobar('Elegir una página cierra el menú móvil', await pagina.locator('[data-menu]').isHidden());
comprobar('Sin desbordamiento horizontal en móvil', await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

await pagina.setViewportSize({ width: 768, height: 900 });
await pagina.goto(`${BASE}/cliente/tienda.html`, { waitUntil: 'networkidle' });
comprobar('Sin desbordamiento horizontal en tablet', await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

const ignorables = errores.filter((e) => !e.includes('favicon'));
comprobar('Sin errores de JavaScript en la consola', ignorables.length === 0, ignorables.join(' | '));

await navegador.close();
apagarServidor();
console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron' : `\n${fallos} comprobaciones fallaron`);
process.exit(fallos === 0 ? 0 : 1);
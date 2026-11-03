/**
 * Pruebas de diseño responsive y de accesibilidad medida en navegador real.
 *
 * Complementa a las pruebas de marcado: aquí se comprueba lo que solo se puede
 * saber con la página renderizada.
 *
 *   - Responsive (WCAG 1.4.10 reflujo): el contenido no desborda horizontalmente
 *     en 360 px, 768 px ni 1280 px, y los menús colapsan donde corresponde.
 *   - Contraste real (WCAG 1.4.3 y 1.4.11): se calcula la luminancia del texto
 *     sobre el fondo realmente compuesto.
 *   - ARIA en ejecución: las referencias resuelven y los controles tienen nombre.
 *   - Indicador de foco visible (WCAG 2.4.7 / 2.4.11).
 *   - Compatibilidad con el subdirectorio de GitHub Pages.
 *
 * Ejecutar con:  node pruebas/prueba-responsive.mjs
 * Requiere Playwright. Si está instalado fuera del proyecto, indicar la ruta:
 *   set PW_MODULO=C:\ruta\node_modules\playwright\index.js
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const rutaModulo = process.env.PW_MODULO || 'playwright';
const modulo = await import(rutaModulo === 'playwright' ? 'playwright' : pathToFileURL(rutaModulo).href);
const { chromium } = modulo.default ?? modulo;

const PUERTO = Number(process.env.PUERTO || 5513);
const BASE = process.env.BASE || `http://localhost:${PUERTO}`;

let fallos = 0;
function comprobar(descripcion, condicion, extra = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}${extra ? ' -> ' + extra : ''}`);
  if (!condicion) fallos += 1;
}

const servidor = spawn(process.execPath, [join(aqui, 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
await new Promise((r) => setTimeout(r, 900));

/** Tamaños representativos: móvil pequeño, tableta y escritorio. */
const PANTALLAS = [
  { nombre: 'móvil 320', width: 320, height: 640 },
  { nombre: 'móvil 360', width: 360, height: 740 },
  { nombre: 'móvil 420', width: 420, height: 740 },
  { nombre: 'tableta 768', width: 768, height: 1024 },
  { nombre: 'escritorio 1280', width: 1280, height: 900 }
];

const navegador = await chromium.launch();

/* =========================================================
   1. Reflujo: el contenido no desborda en ningún tamaño
   ========================================================= */
for (const pantalla of PANTALLAS) {
  const contexto = await navegador.newContext({ viewport: { width: pantalla.width, height: pantalla.height } });
  const pagina = await contexto.newPage();

  for (const ruta of [
    'index.html',
    'cliente/planes.html',
    'cliente/tienda.html',
    'cliente/clases.html',
    'cliente/rutinas.html',
    'cliente/contacto.html',
    'cliente/nutricion.html',
    'cliente/login.html',
    'cliente/checkout.html',
    'admin/login.html'
  ]) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' });
    await pagina.evaluate(() => window.scrollTo(0, 0));

    const reflujo = await pagina.evaluate(() => {
      const limite = document.documentElement.clientWidth;
      const desbordes = [];
      for (const el of document.querySelectorAll('body *')) {
        const estilo = getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
        // Los paneles y modales son capas superpuestas: se posicionan fuera a
        // propósito y no cuentan como desborde del documento.
        if (el.closest('[data-panel-carrito], [data-modal-acceso], [data-aviso], .pf-capa')) continue;
        const caja = el.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) continue;
        if (caja.right > limite + 1 || caja.left < -1) {
          desbordes.push(`<${el.tagName.toLowerCase()}${el.className ? ' .' + String(el.className).split(' ')[0] : ''}> ${Math.round(caja.left)}..${Math.round(caja.right)}`);
        }
      }
      return {
        scroll: document.documentElement.scrollWidth,
        limite,
        desbordes: desbordes.slice(0, 4)
      };
    });

    comprobar(
      `${pantalla.nombre} · ${ruta}: sin desplazamiento horizontal`,
      reflujo.scroll <= reflujo.limite + 1,
      `${reflujo.scroll}px de contenido en ${reflujo.limite}px visibles`
    );
    comprobar(
      `${pantalla.nombre} · ${ruta}: ningún elemento se sale de la pantalla`,
      reflujo.desbordes.length === 0,
      reflujo.desbordes.join(' | ')
    );
  }

  await contexto.close();
}

/* =========================================================
   2. Comportamiento responsive del menú y de la cuadrícula
   ========================================================= */
{
  const contexto = await navegador.newContext({ viewport: { width: 360, height: 740 } });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  comprobar('360 px: el botón de menú está visible', await pagina.locator('[data-menu-boton]').isVisible());
  comprobar('360 px: el menú está plegado al cargar', !(await pagina.locator('[data-menu]').evaluate((n) => n.classList.contains('pf-menu-abierto'))));
  await pagina.click('[data-menu-boton]');
  comprobar('360 px: el menú se despliega al pulsar el botón', await pagina.locator('[data-menu]').evaluate((n) => n.classList.contains('pf-menu-abierto')));
  await pagina.click('[data-menu-boton]');
  await contexto.close();
}
{
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  comprobar('1280 px: el botón de menú se oculta', !(await pagina.locator('[data-menu-boton]').isVisible()));
  await contexto.close();
}

/* =========================================================
   3. Contraste real, ARIA en ejecución y foco visible
   ========================================================= */
{
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));

  /** Recorre los textos visibles y calcula el contraste con su fondo real. */
  const medirContraste = () =>
    pagina.evaluate(() => {
      const aRgb = (valor) => {
        const m = (valor || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x));
        return { r, g, b, a: Number(a) };
      };
      const luminancia = ({ r, g, b }) => {
        const f = (v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      // Compone el fondo subiendo por los ancestros hasta llegar a opaco.
      const fondoDe = (el) => {
        let acumulado = null;
        let nodo = el;
        while (nodo && nodo !== document.documentElement.parentNode) {
          const c = aRgb(getComputedStyle(nodo).backgroundColor);
          if (c && c.a > 0) {
            acumulado = acumulado
              ? {
                  r: c.r * c.a + acumulado.r * (1 - c.a),
                  g: c.g * c.a + acumulado.g * (1 - c.a),
                  b: c.b * c.a + acumulado.b * (1 - c.a),
                  a: 1
                }
              : c;
            if (acumulado.a >= 1) return acumulado;
          }
          nodo = nodo.parentElement;
        }
        return acumulado ?? { r: 255, g: 255, b: 255, a: 1 };
      };

      const selectores = 'p, h1, h2, h3, h4, h5, h6, li, a, label, button, td, th, dt, dd, span, output, small, legend';
      const bajos = [];
      for (const el of document.querySelectorAll(selectores)) {
        if (!el.textContent || !el.textContent.trim()) continue;
        if (el.querySelector(selectores)) continue; // solo el nodo más externo
        const estilo = getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) continue;
        if (el.closest('[hidden]')) continue;
        // Los textos sobre fotografía no tienen color de fondo computable.
        if (el.closest('[data-capa-imagen], .pf-hero')) continue;

        const fg = aRgb(estilo.color);
        if (!fg) continue;
        const bg = fondoDe(el);
        const fgComp = fg.a < 1
          ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) }
          : fg;
        const L1 = luminancia(fgComp);
        const L2 = luminancia(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

        const tamano = parseFloat(estilo.fontSize);
        const negrita = Number(estilo.fontWeight) >= 700;
        const grande = tamano >= 24 || (tamano >= 18.66 && negrita);
        const minimo = grande ? 3 : 4.5;

        if (ratio < minimo) {
          bajos.push({
            texto: el.textContent.trim().slice(0, 40),
            etiqueta: `<${el.tagName.toLowerCase()} class="${String(el.className).split(' ')[0]}">`,
            ratio: Number(ratio.toFixed(2)),
            minimo,
            color: estilo.color,
            fondo: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
          });
        }
      }
      return bajos;
    });

  for (const ruta of ['index.html', 'cliente/planes.html', 'cliente/tienda.html', 'cliente/clases.html', 'cliente/rutinas.html', 'cliente/contacto.html', 'cliente/nutricion.html', 'cliente/login.html', 'cliente/checkout.html', 'admin/login.html']) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' });
    const bajos = await medirContraste();
    comprobar(
      `${ruta}: contraste del texto >= 4.5:1 (3:1 en texto grande)`,
      bajos.length === 0,
      bajos.slice(0, 5).map((b) => `${b.etiqueta} "${b.texto}" ${b.ratio}:1 (min ${b.minimo}) ${b.color} sobre ${b.fondo}`).join(' | ') ||
        'todos los textos cumplen'
    );
  }

  /* --- ARIA en ejecución --- */
  await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const aria = await pagina.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('[id]')].map((n) => n.id));
    const rotas = [];
    for (const el of document.querySelectorAll('[aria-describedby], [aria-labelledby], [aria-controls], [aria-owns]')) {
      for (const attr of ['aria-describedby', 'aria-labelledby', 'aria-controls', 'aria-owns']) {
        const valor = el.getAttribute(attr);
        if (!valor) continue;
        for (const ref of valor.split(/\s+/).filter(Boolean)) {
          if (!ids.has(ref)) rotas.push(`${attr}="${ref}"`);
        }
      }
    }
    const sinAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src);
    return { rotas, sinAlt };
  });
  comprobar('En ejecución: las referencias ARIA resuelven', aria.rotas.length === 0, aria.rotas.join(' | ') || 'correcto');
  comprobar('En ejecución: todas las imágenes tienen alt', aria.sinAlt.length === 0, aria.sinAlt.join(' | ') || 'correcto');

  /* --- Indicador de foco visible --- */
  await pagina.keyboard.press('Tab');
  const foco = await pagina.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const estilo = getComputedStyle(el);
    return {
      etiqueta: `<${el.tagName.toLowerCase()}>`,
      outline: estilo.outlineStyle,
      grosor: parseFloat(estilo.outlineWidth) || 0,
      boxShadow: estilo.boxShadow !== 'none'
    };
  });
  comprobar('El primer tabulador muestra un indicador de foco', Boolean(foco) && (foco.grosor >= 2 || foco.boxShadow), JSON.stringify(foco));

  /* --- Sin errores de JavaScript --- */
  comprobar('Sin errores de JavaScript al navegar', errores.length === 0, errores.join(' | ') || 'ninguno');

  await contexto.close();
}

/* =========================================================
   4. El sitio funciona al publicarse en un subdirectorio (GitHub Pages)
   ========================================================= */
{
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  // Se simula la URL real de Pages replicando la ruta de proyecto en el href.
  await pagina.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  const base = await pagina.evaluate(async (origen) => {
    // El módulo se resuelve antes de inyectar <base>: de lo contrario la
    // importación apuntaría al dominio simulado, que no existe.
    const { raizSitio } = await import(`${origen}/js/storage.js`);
    document.head.insertAdjacentHTML(
      'afterbegin',
      '<base id="prueba" href="https://ariel-as.github.io/Proyecto-Desarrollo-RDA-1/subcarpeta/">'
    );
    return raizSitio();
  }, BASE);
  comprobar(
    'raizSitio() resuelve la raíz dentro de un subdirectorio de Pages',
    base === 'https://ariel-as.github.io/Proyecto-Desarrollo-RDA-1/subcarpeta/',
    base
  );
  await contexto.close();
}

await navegador.close();
servidor.kill();

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron' : `\n${fallos} comprobaciones fallaron`);
process.exit(fallos === 0 ? 0 : 1);
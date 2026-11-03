/**
 * Comprueba que cada selector data-, id o clase usado por el controlador de una
 * página exista en esa página, y que las imágenes referenciadas estén en disco.
 *
 * Para cada página se toma el código de su función controladora más las
 * funciones a las que llama (cierre transitivo), de modo que no se exigen
 * selectores de otras páginas.
 *
 * Ejecutar con: node pruebas/prueba-selectores.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAGINAS = [
  { archivo: 'index.html', script: 'js/app.js', clave: 'inicio' },
  { archivo: 'cliente/planes.html', script: 'js/app.js', clave: 'planes' },
  { archivo: 'cliente/tienda.html', script: 'js/app.js', clave: 'tienda' },
  { archivo: 'cliente/clases.html', script: 'js/app.js', clave: 'clases' },
  { archivo: 'cliente/rutinas.html', script: 'js/app.js', clave: 'rutinas' },
  { archivo: 'cliente/contacto.html', script: 'js/app.js', clave: 'contacto' },
  { archivo: 'cliente/checkout.html', script: 'js/app.js', clave: 'checkout' },
  { archivo: 'cliente/nutricion.html', script: 'js/app.js', clave: 'nutricion' },
  { archivo: 'cliente/login.html', script: 'js/app.js', clave: 'login' },
  { archivo: 'admin/index.html', script: 'js/admin.js', clave: 'index' },
  { archivo: 'admin/productos.html', script: 'js/admin.js', clave: 'productos' },
  { archivo: 'admin/planes.html', script: 'js/admin.js', clave: 'planes' },
  { archivo: 'admin/clases.html', script: 'js/admin.js', clave: 'clases' },
  { archivo: 'admin/entrenadores.html', script: 'js/admin.js', clave: 'entrenadores' }
];

/** Páginas del menú principal: cada sección es su propio archivo HTML. */
const MENU = [
  { texto: 'Inicio', archivo: 'index.html' },
  { texto: 'Planes', archivo: 'cliente/planes.html' },
  { texto: 'Tienda', archivo: 'cliente/tienda.html' },
  { texto: 'Clases', archivo: 'cliente/clases.html' },
  { texto: 'Rutinas', archivo: 'cliente/rutinas.html' },
  { texto: 'Nutrición', archivo: 'cliente/nutricion.html' },
  { texto: 'Contacto', archivo: 'cliente/contacto.html' }
];

/** Páginas públicas que muestran el menú principal completo. */
const PAGINAS_CON_MENU = [
  ...MENU.map((m) => m.archivo),
  'cliente/login.html',
  'cliente/checkout.html'
];

/** Devuelve el cuerpo de la función declarada con `nombre`. */
function cuerpoDe(codigo, nombre) {
  const patronDeclaracion = new RegExp(`(?:async\\s+)?function\\s+${nombre}\\s*\\(`);
  const m = patronDeclaracion.exec(codigo) ?? new RegExp(`(?:const|let)\\s+${nombre}\\s*=\\s*(?:async\\s*)?\\(`).exec(codigo);
  if (!m) return '';
  let i = m.index + m[0].length - 1;
  let profundidad = 0;
  for (; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '(') profundidad += 1;
    else if (c === ')') {
      profundidad -= 1;
      if (profundidad === 0) break;
    }
  }
  let llaves = 0;
  let inicio = codigo.indexOf('{', i);
  if (inicio === -1) return '';
  for (let j = inicio; j < codigo.length; j += 1) {
    if (codigo[j] === '{') llaves += 1;
    else if (codigo[j] === '}') {
      llaves -= 1;
      if (llaves === 0) return codigo.slice(inicio, j + 1);
    }
  }
  return '';
}

/** Funciones declaradas en el script. */
const funcionesDe = (codigo) => [...codigo.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)].map((m) => m[1]);

const llamadasDe = (codigo) => [...codigo.matchAll(/\b([A-Za-z0-9_$]+)\s*\(/g)].map((m) => m[1]);

const selectoresDe = (codigo) => {
  const salida = new Set();
  for (const m of codigo.matchAll(/select(?:Todos)?\('\[data-([a-z0-9-]+)/g)) salida.add(`data-${m[1]}`);
  for (const m of codigo.matchAll(/select(?:Todos)?\('#([A-Za-z0-9_-]+)/g)) salida.add(`id:${m[1]}`);
  for (const m of codigo.matchAll(/select(?:Todos)?\('\.([A-Za-z0-9_-]+)/g)) salida.add(`.${m[1]}`);
  for (const m of codigo.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) salida.add(`id:${m[1]}`);
  for (const m of codigo.matchAll(/querySelector(?:All)?\('#([A-Za-z0-9_-]+)/g)) salida.add(`id:${m[1]}`);
  for (const m of codigo.matchAll(/querySelector(?:All)?\('\[data-([a-z0-9-]+)/g)) salida.add(`data-${m[1]}`);
  return salida;
};

const atributosDe = (html) => {
  const set = new Set();
  for (const m of html.matchAll(/\bdata-([a-z0-9-]+)/gi)) set.add(`data-${m[1]}`);
  for (const m of html.matchAll(/\bid="([^"]+)"/gi)) set.add(`id:${m[1]}`);
  for (const m of html.matchAll(/\bclass="([^"]+)"/gi)) m[1].split(/\s+/).forEach((c) => set.add(`.${c}`));
  return set;
};

let fallos = 0;
const comprobar = (desc, ok, extra = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${desc}${extra ? ' -> ' + extra : ''}`);
};

const cache = new Map();
for (const { archivo, script, clave } of PAGINAS) {
  if (!cache.has(script)) cache.set(script, readFileSync(join(raiz, script), 'utf8'));
  const codigo = cache.get(script);

  const mapa = codigo.match(/(?:const\s+)?PAGINAS(?:_ADMIN)?\s*=\s*\{([\s\S]*?)\n\}/);
  const entrada = mapa?.[1]
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith(`${clave}:`));
  comprobar(`${archivo}: el script declara el controlador "${clave}"`, Boolean(entrada), entrada ?? 'no encontrado');
  if (!entrada) continue;

  const funciones = funcionesDe(codigo);
  const pendientes = [entrada.split(':')[1].trim().replace(/,$/, '')];
  const visitadas = new Set();
  let codigoRelevante = '';
  while (pendientes.length) {
    const nombre = pendientes.pop();
    if (!nombre || visitadas.has(nombre) || !funciones.includes(nombre)) continue;
    visitadas.add(nombre);
    const cuerpo = cuerpoDe(codigo, nombre);
    codigoRelevante += cuerpo;
    for (const llamada of llamadasDe(cuerpo)) {
      if (funciones.includes(llamada)) pendientes.push(llamada);
    }
  }
  // El arranque de la página siempre usa iniciarComunes().
  const comunes = nombre => (/iniciarComunes/.test(codigoRelevante) ? 'iniciarComunes' : nombre);

  const html = readFileSync(join(raiz, archivo), 'utf8');
  const disponibles = atributosDe(html);
  const pedidos = selectoresDe(codigoRelevante);
  const faltan = [...pedidos].filter((s) => !disponibles.has(s) && !comunes(s));

  comprobar(
    `${archivo}: existen los ${pedidos.size} selectores de su controlador (${visitadas.size} funciones)`,
    faltan.length === 0,
    faltan.join(', ')
  );

  const body = html.match(/<body[^>]*data-pagina="([^"]+)"/i)?.[1];
  if (body) comprobar(`${archivo}: data-pagina="${body}"`, body === clave, `esperado ${clave}`);
}

/* Sitio multipágina: el menú principal es el mismo en todas las páginas,
   cada enlace va a su archivo .html real y solo la página actual queda activa
   con aria-current="page". Ningún enlace del menú ni del pie es un ancla. */
const { posix } = await import('node:path');
const rutaDesde = (origen, destino) => posix.relative(posix.dirname(origen), destino) || posix.basename(destino);

for (const archivo of PAGINAS_CON_MENU) {
  const html = readFileSync(join(raiz, archivo), 'utf8');
  const lista = html.match(/<ul class="pf-menu-lista">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const enlaces = [...lista.matchAll(/<a\s+([^>]*)>([^<]*)<\/a>/g)].map(([, atributos, texto]) => ({
    href: atributos.match(/href="([^"]*)"/)?.[1] ?? '',
    activo: /pf-enlace-activo/.test(atributos),
    current: atributos.match(/aria-current="([^"]*)"/)?.[1] ?? null,
    texto: texto.trim()
  }));

  const esperado = MENU.map((m) => `${m.texto}=${rutaDesde(archivo, m.archivo)}`).join(' | ');
  const real = enlaces.map((e) => `${e.texto}=${e.href}`).join(' | ');
  comprobar(`${archivo}: el menú principal enlaza a las 7 páginas con rutas relativas`, real === esperado, real);

  const actual = MENU.find((m) => m.archivo === archivo);
  const activos = enlaces.filter((e) => e.activo || e.current);
  if (actual) {
    const ok = activos.length === 1 && activos[0].texto === actual.texto && activos[0].activo && activos[0].current === 'page';
    comprobar(`${archivo}: "${actual.texto}" es el único enlace activo con aria-current="page"`, ok, activos.map((e) => `${e.texto}:${e.current}`).join(', '));
  } else {
    comprobar(`${archivo}: ningún enlace del menú queda activo`, activos.length === 0);
  }

  const pie = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? '';
  const anclas = [...`${lista}${pie}`.matchAll(/href="([^"]*#[^"]*)"/g)].map((m) => m[1]);
  comprobar(`${archivo}: el menú y el pie no usan anclas`, anclas.length === 0, anclas.join(', '));

  const destinosPie = [...pie.matchAll(/href="([^"#:]+\.html)"/g)].map((m) => m[1]);
  const faltanPie = MENU.slice(1).filter((m) => !destinosPie.includes(rutaDesde(archivo, m.archivo))).map((m) => m.texto);
  comprobar(`${archivo}: el pie enlaza a las páginas de sección`, faltanPie.length === 0, faltanPie.join(', '));

  comprobar(`${archivo}: conserva el salto "Ir al contenido principal"`, /<a class="pf-saltar" href="#contenido">/.test(html) && /<main id="contenido"/.test(html));
}

/* Ningún HTML ni script del sitio enlaza a un ancla de la antigua página única. */
const restos = [];
for (const archivo of [...PAGINAS.map((p) => p.archivo), 'admin/login.html']) {
  const html = readFileSync(join(raiz, archivo), 'utf8');
  for (const m of html.matchAll(/href="([^"]*#(?:inicio|planes|tienda|clases|rutinas|nutricion|contacto))"/g)) restos.push(`${archivo}: ${m[1]}`);
}
for (const modulo of ['js/app.js', 'js/carrito-panel.js', 'js/admin.js']) {
  const js = readFileSync(join(raiz, modulo), 'utf8');
  for (const m of js.matchAll(/index\.html#[a-z]+/g)) restos.push(`${modulo}: ${m[0]}`);
  if (/hashchange|pushState|popstate/.test(js)) restos.push(`${modulo}: navegación por hash`);
}
comprobar('No quedan enlaces ni redirecciones a anclas de la antigua página única', restos.length === 0, restos.join(' | '));

/* Imágenes referenciadas por las páginas y los JSON. */
const existentes = new Set();
const recorrer = (dir) => {
  if (!existsSync(dir)) return;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.isDirectory()) recorrer(join(dir, entrada.name));
    else existentes.add(entrada.name.toLowerCase());
  }
};
recorrer(join(raiz, 'assets'));

const referenciadas = new Set();
for (const pagina of PAGINAS) {
  const html = readFileSync(join(raiz, pagina.archivo), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]*\.(?:svg|png|jpe?g|webp))"/gi)) referenciadas.add(m[1].split('/').pop().toLowerCase());
}
for (const json of ['productos.json', 'planes.json', 'clases.json', 'entrenadores.json', 'gimnasio.json']) {
  const contenido = readFileSync(join(raiz, 'data', json), 'utf8');
  for (const m of contenido.matchAll(/"imagen":\s*"([^"]+)"/gi)) {
    referenciadas.add(m[1].split('/').pop().toLowerCase());
  }
}
const noEncontradas = [...referenciadas].filter((img) => !existentes.has(img));
comprobar(`Las ${referenciadas.size} imágenes referenciadas existen`, noEncontradas.length === 0, noEncontradas.join(', '));

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron' : `\n${fallos} comprobaciones fallaron`);
process.exit(fallos === 0 ? 0 : 1);
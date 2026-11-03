/**
 * Comprueba lo que las demás pruebas no cubren por ser código y no resultado:
 *
 *  1. Las capas del proyecto (MVC con JavaScript nativo, sin jQuery).
 *  2. El contrato de JavaScript ES6+ y la higiene del código.
 *  3. El contrato de formularios y validaciones accesibles.
 *  4. El contrato de teclado y foco de menús y diálogos.
 *
 * No necesita navegador. Lo que sí exige ejecución real (recorrido completo,
 * responsive, contraste medido y foco en pantalla) está en prueba-navegador.mjs y
 * prueba-responsive.mjs.
 *
 * Ejecutar con: node pruebas/prueba-arquitectura.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let fallos = 0;
function comprobar(descripcion, condicion, extra = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}${extra ? ' -> ' + extra : ''}`);
  if (!condicion) fallos += 1;
}

const leer = (relativa) => readFileSync(join(raiz, relativa), 'utf8');

const PAGINAS = [
  'index.html',
  'cliente/planes.html',
  'cliente/tienda.html',
  'cliente/clases.html',
  'cliente/rutinas.html',
  'cliente/contacto.html',
  'cliente/checkout.html',
  'cliente/login.html',
  'cliente/nutricion.html',
  'admin/login.html',
  'admin/index.html',
  'admin/productos.html',
  'admin/planes.html',
  'admin/clases.html',
  'admin/entrenadores.html'
];

const MODULOS = readdirSync(join(raiz, 'js'))
  .filter((nombre) => nombre.endsWith('.js'))
  .sort()
  .map((nombre) => `js/${nombre}`);

const codigo = new Map(MODULOS.map((modulo) => [modulo, leer(modulo)]));
const html = new Map(PAGINAS.map((pagina) => [pagina, leer(pagina)]));
const todoElCodigo = (modulos) => modulos.map((m) => codigo.get(m)).join('\n');
const todoElHtml = [...html.values()].join('\n');

/* =========================================================
   1. Capas del proyecto: MVC con JavaScript nativo
   ========================================================= */

/* El proyecto usa Bootstrap 5.3.3, que ya no depende de jQuery, y Tailwind por
   CDN. Si algún día se carga jQuery, esta comprobación lo avisa para poder
   aplicar además las buenas prácticas propias de esa librería. */
const usosJquery = [
  ...MODULOS.filter((m) => /(^|[^\w$.])jQuery\s*\(|\$\s*\(\s*document\s*\)/.test(codigo.get(m))),
  ...PAGINAS.filter((p) => /jquery(?:\.min)?\.js/i.test(html.get(p)))
];
comprobar(
  'No hay jQuery en el proyecto, así que sus buenas prácticas no aplican',
  usosJquery.length === 0,
  usosJquery.join(', ') || 'ninguna referencia'
);

const MODELO = ['js/repo.js', 'js/cart.js', 'js/storage.js', 'js/indexeddb.js', 'js/auth.js'];
const VISTA = ['js/view.js'];
const CONTROL = ['js/app.js', 'js/admin.js'];
comprobar(
  `Las tres capas existen (modelo: ${MODELO.length}, vista: ${VISTA.length}, control: ${CONTROL.length})`,
  [...MODELO, ...VISTA, ...CONTROL].every((m) => MODULOS.includes(m)),
  [...MODELO, ...VISTA, ...CONTROL].filter((m) => !MODULOS.includes(m)).join(', ')
);

/* El modelo guarda datos y estado; no debe fabricar HTML. */
const modeloConHtml = MODELO.filter((m) => /innerHTML|insertAdjacentHTML|createElement/.test(codigo.get(m)));
comprobar('El modelo no genera HTML: solo guarda y devuelve datos', modeloConHtml.length === 0, modeloConHtml.join(', '));

/* La vista solo pinta: no habla con el almacenamiento ni con la red. */
const vistaConDatos = VISTA.filter((m) => /localStorage|sessionStorage|indexedDB|fetch\(/.test(codigo.get(m)));
comprobar('La vista no accede al almacenamiento ni a la red', vistaConDatos.length === 0, vistaConDatos.join(', '));

/* La vista debe escapar todo lo que llegue de los JSON. */
const vistaTexto = todoElCodigo(VISTA);
comprobar('La vista exporta escapar() para sanear los datos', /export function escapar\s*\(/.test(vistaTexto));
const plantillasSinEscapar = (vistaTexto.match(/\$\{/g) || []).length;
comprobar(
  `La vista interpola datos escapados (${plantillasSinEscapar} interpolaciones revisadas)`,
  /escapar\(/.test(vistaTexto),
  'sin ninguna llamada a escapar()'
);

/* El control enruta por data-pagina y consume modelo y vista. */
comprobar(
  'El enrutador público mapea data-pagina a un controlador',
  /const\s+PAGINAS\s*=\s*\{/.test(codigo.get('js/app.js')) && /dataset\.pagina/.test(codigo.get('js/app.js'))
);
comprobar(
  'El enrutador del panel de administración hace lo mismo',
  /const\s+PAGINAS_ADMIN\s*=\s*\{/.test(codigo.get('js/admin.js')) && /dataset\.pagina/.test(codigo.get('js/admin.js'))
);
const controlador = todoElCodigo(CONTROL);
const sinImportar = ['./repo.js', './view.js', './validation.js'].filter((mod) => !controlador.includes(mod));
comprobar('El control consume por import el modelo, la vista y la validación', sinImportar.length === 0, sinImportar.join(', '));

/* =========================================================
   2. JavaScript ES6+ e higiene del código
   ========================================================= */

const sinEsModulo = MODULOS.filter((m) => !/^\s*(import|export)\b/m.test(codigo.get(m)));
comprobar('Todos los módulos de js/ usan import/export (ES modules)', sinEsModulo.length === 0, sinEsModulo.join(', '));

/* Los scripts propios se cargan como módulos; el único clásico es
   assets/js/identidad.js, que debe correr de forma síncrona antes del análisis. */
const scriptsModulo = [...todoElHtml.matchAll(/<script[^>]*src="((?:\.\.\/)?js\/[^"]+)"[^>]*>/g)];
const cargadosComoClasico = scriptsModulo.filter(([etiqueta]) => !/type="module"/.test(etiqueta)).map(([, ruta]) => ruta);
comprobar(
  `Los ${scriptsModulo.length} scripts de js/ se cargan con type="module"`,
  cargadosComoClasico.length === 0,
  cargadosComoClasico.join(', ')
);
const identidad = leer('assets/js/identidad.js');
comprobar(
  'identidad.js es un script clásico y por eso no usa import/export',
  !/^\s*(import|export)\b/m.test(identidad) && /tailwind\.config/.test(identidad)
);

const ANTIPATRONES = [
  { nombre: 'var', patron: /(^|[^\w$.])var\s+[A-Za-z_$]/ },
  { nombre: 'debugger', patron: /(^|[^\w$])debugger\b/ },
  { nombre: 'eval', patron: /(^|[^\w$.])eval\s*\(/ },
  { nombre: 'new Function', patron: /new\s+Function\s*\(/ },
  { nombre: 'document.write', patron: /document\.write(?:ln)?\s*\(/ },
  { nombre: 'console.log de depuración', patron: /console\.log\s*\(/ },
  { nombre: 'alert/confirm', patron: /(^|[^\w$.])(alert|confirm|prompt)\s*\(/ }
];
const found = ANTIPATRONES.flatMap(({ nombre, patron }) => {
  const culpable = MODULOS.filter((m) => patron.test(codigo.get(m)));
  return culpable.length ? [`${nombre} en ${culpable.join(', ')}`] : [];
});
comprobar(`Ningún módulo usa ${ANTIPATRONES.map((a) => a.nombre).join(', ')}`, found.length === 0, found.join(' | ') || 'cero apariciones');

/* =========================================================
   3. Formularios y validaciones accesibles
   ========================================================= */

const formularios = [...todoElHtml.matchAll(/<form\b[^>]*>/g)].map(([etiqueta]) => etiqueta);
const sinNovalidate = [...todoElHtml.matchAll(/<form\b(?![^>]*novalidate)[^>]*>/g)].map(([etiqueta]) => etiqueta);
comprobar(
  `Los ${formularios.length} formularios delegan la validación en construirValidador (novalidate)`,
  sinNovalidate.length === 0,
  sinNovalidate.join(' ')
);

const idsFormulario = [...todoElHtml.matchAll(/<form[^>]*id="([^"]+)"/g)].map(([, id]) => id);
const sinValidador = idsFormulario.filter((id) => !controlador.includes(`'#${id}'`));
comprobar('Cada formulario está conectado a un construirValidador', sinValidador.length === 0, sinValidador.join(', ') || 'todos conectados');

/* Los campos de identidad declaran qué información recogen (WCAG 1.3.5) y los
   que no son personales se desactivan para que el navegador no ofrezca un
   nombre de persona donde no toca. */
const TOKENS_POR_TIPO = [
  { tipo: 'email', token: 'email' },
  { tipo: 'tel', token: 'tel' }
];
const tiposSinToken = TOKENS_POR_TIPO.flatMap(({ tipo, token }) => {
  const campos = [...todoElHtml.matchAll(new RegExp(`<input\\b(?=[^>]*type="${tipo}")[^>]*>`, 'g'))];
  const malos = campos.filter(([etiqueta]) => !etiqueta.includes(`autocomplete="${token}"`));
  return malos.length ? [`type="${tipo}" sin autocomplete="${token}" (${malos.length})`] : [];
});
comprobar(
  'Cada campo de correo y de teléfono declara autocomplete',
  tiposSinToken.length === 0,
  tiposSinToken.join(' | ') || 'todos correctos'
);

const textos = [...todoElHtml.matchAll(/<input\b(?=[^>]*type="text")[^>]*>/g)];
const textosSinAutocomplete = textos
  .filter(([etiqueta]) => !etiqueta.includes('autocomplete='))
  .map(([etiqueta]) => etiqueta.match(/id="([^"]+)"/)?.[1] ?? '?');
comprobar(
  'Cada campo de texto declara autocomplete (incluido autocomplete="off")',
  textosSinAutocomplete.length === 0,
  textosSinAutocomplete.join(', ') || `${textos.length} campos revisados`
);

/* Los únicos campos con autocomplete="name" son los que piden el nombre de la
   persona, no el de un producto o un plan. */
const nombreDePersona = new Map([
  ['cliente/contacto.html', 'nombre'],
  ['cliente/checkout.html', 'nombre'],
  ['cliente/nutricion.html', 'nombre'],
  ['cliente/login.html', 'nombre-registro']
]);
const nombreMalPuesto = [];
for (const [pagina, id] of nombreDePersona) {
  const campo = html.get(pagina).match(new RegExp(`<input\\b(?=[^>]*id="${id}")[^>]*>`))?.[0] ?? '';
  if (!campo.includes('autocomplete="name"')) nombreMalPuesto.push(`${pagina}#${id}`);
}
comprobar(
  'Los campos que piden el nombre de la persona usan autocomplete="name"',
  nombreMalPuesto.length === 0,
  nombreMalPuesto.join(', ') || 'los cuatro correctos'
);

const validacion = codigo.get('js/validation.js');
comprobar('El error se anuncia con aria-invalid', /campo\.setAttribute\('aria-invalid',\s*'true'\)/.test(validacion));
comprobar('El error se limpia al corregir el campo', /campo\.removeAttribute\('aria-invalid'\)/.test(validacion));
comprobar('El mensaje de error se enlaza con aria-describedby sin perder las ayudas', /describirConError/.test(validacion) && /describirSinError/.test(validacion));
comprobar('El mensaje de error se inserta como role="alert"', /setAttribute\('role',\s*'alert'\)/.test(validacion));
comprobar('La validación nativa se refuerza con setCustomValidity', /setCustomValidity/.test(validacion));
comprobar('El envío se intercepta con preventDefault', /evento\.preventDefault\(\)/.test(validacion));
comprobar('Al fallar, el foco salta al primer campo inválido', /primero\.focus\(\)/.test(validacion));
comprobar('Los avisos dinámicos se anuncian en una región aria-live', /mostrarMensaje[\s\S]*aria-live/.test(validacion) || /region\.dataset\.tipo/.test(validacion));

/* =========================================================
   4. Teclado y foco en menús y diálogos
   ========================================================= */

const panel = codigo.get('js/carrito-panel.js');
comprobar('El panel del carrito se expone como diálogo modal', /role="dialog"/.test(panel) && /aria-modal="true"/.test(panel));
comprobar('Al abrir un diálogo el foco entra en él', /enfocarEnDialogo\(panel\.querySelector\('\[data-cerrar-carrito\]'\)\)/.test(panel) && /enfocarEnDialogo\(modal\.querySelector\('#acceso-correo'\)\)/.test(panel));
comprobar(
  'El foco se reintenta hasta que el diálogo ya es visible',
  /function\s+enfocarEnDialogo[\s\S]{0,400}document\.activeElement\s*===\s*elemento/.test(panel) &&
    /requestAnimationFrame\(intentar\)/.test(panel)
);
comprobar('El diálogo recuerda qué tenía el foco para devolverlo', /focoAnterior\s*=\s*document\.activeElement/.test(panel));
comprobar('Al cerrar, el foco vuelve al elemento que lo abrió', /devolverFoco[\s\S]{0,120}focoAnterior\.focus\(\)/.test(panel));
comprobar('Tab queda atrapado dentro del diálogo abierto', /function\s+confinarFoco\s*\(/.test(panel) && /evento\.preventDefault\(\)/.test(panel));
comprobar('La trampa de foco se aplica al pulsar Tab', /evento\.key\s*!==\s*'Tab'/.test(panel));
comprobar('Escape cierra el diálogo abierto', /evento\.key\s*===\s*'Escape'/.test(panel));

const app = codigo.get('js/app.js');
comprobar('El botón del menú publica su estado en aria-expanded', /boton\.setAttribute\('aria-expanded',\s*'true'\)/.test(app) && /boton\.setAttribute\('aria-expanded',\s*'false'\)/.test(app));
comprobar('Escape cierra el menú móvil', /evento\.key\s*===\s*'Escape'\s*&&\s*estaAbierto\(\)/.test(app));
comprobar('Al cerrar el menú el foco vuelve a su botón', /boton\.focus\(\)/.test(app));

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron' : `\n${fallos} comprobaciones fallaron`);
process.exit(fallos === 0 ? 0 : 1);
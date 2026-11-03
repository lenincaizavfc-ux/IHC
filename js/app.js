/**
 * app.js - Controlador de las páginas del área cliente.
 *
 * Actúa como punto de entrada: lee `data-pagina` del <body> y ejecuta
 * solamente el controlador que la página necesita. También resuelve lo
 * que es común a todas las páginas (aviso de cookies, contador del
 * carrito, panel lateral del carrito, menú móvil, sesión y año del pie).
 */

import { obtenerProductos, obtenerPlanes, obtenerClases, obtenerEntrenadores, obtenerGimnasio, generarIdCita, generarIdPedido } from './repo.js';
import { guardarRegistro, ALMACENES } from './indexeddb.js';
import { carrito, formatearPrecio } from './cart.js';
import { iniciarPanelCarrito, panelCarrito } from './carrito-panel.js';
import {
  actualizarContadorCarrito,
  actualizarEstadoSesion,
  escapar,
  mostrarAviso,
  renderizar,
  seccionCategoriaTienda,
  tarjetaClase,
  tarjetaEntrenador,
  tarjetaPlan,
  tarjetaProducto,
  tarjetaServicio,
  vacio
} from './view.js';
import {
  CLAVES,
  leerLocal,
  escribirLocal,
  leerCookie,
  escribirCookie,
  leerActualizacion,
  formatearFecha,
  registrarActualizacion,
  raizSitio
} from './storage.js';
import {
  iniciarSesion,
  cerrarSesion,
  usuarioActual,
  guardarPendencia,
  tienePendencia,
  registrarCliente,
  existeRegistroLocal
} from './auth.js';
import {
  construirValidador,
  mostrarMensaje,
  validarCedula,
  validarContrasena,
  validarFechaFutura,
  validarNombre,
  validarTelefono,
  validarCoincidencia
} from './validation.js';

/** Contenedores y estados compartidos por los controladores. */
const select = (selector) => document.querySelector(selector);
const selectTodos = (selector) => [...document.querySelectorAll(selector)];

/* =========================================================
   1. Comportamiento común a todas las páginas
   ========================================================= */

/**
 * Muestra el aviso de cookies solo si la persona todavía no lo ha cerrado.
 *
 * El aviso llega en el HTML con `hidden` a propósito. Antes venía visible y
 * `js/app.js` lo escondía al leer la cookie, así que en cada recarga se veía
 * aparecer un instante y desaparecer: quien ya había pulsado «Entendido»
 * pensaba que el aviso volvía. Oculto desde el principio, el módulo lo enseña
 * solo en la primera visita; el resto de las cargas ni lo pintan.
 */
function iniciarAvisoCookies() {
  const aviso = select('[data-aviso-cookies]');
  if (!aviso) return;

  if (leerCookie(CLAVES.cookieAviso) === 'aceptado') {
    aviso.hidden = true;
    return;
  }

  aviso.hidden = false;

  const boton = select('[data-aceptar-cookies]');
  boton?.addEventListener('click', () => {
    // La preferencia se recuerda con una cookie, no con localStorage.
    escribirCookie(CLAVES.cookieAviso, 'aceptado', 180);
    aviso.hidden = true;
    mostrarAviso('Preferencia de cookies guardada. Gracias.', 'exito');
  });
}

/**
 * Mantiene el foco dentro del panel del menú mientras está desplegado.
 * El menú se superpone al contenido, así que si el foco se escapara al hero o
 * al botón del carrito, quien navega con teclado leería controles que no ve
 * (WCAG 2.2, 2.4.3). El botón que lo abre actúa como parte del panel, así que
 * `Shift + Tab` desde el primer enlace vuelve a él en lugar de cerrarlo.
 */
function confinarFocoEnMenu(menu, boton, evento) {
  const focusables = [
    ...menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ].filter((nodo) => nodo.offsetParent !== null || nodo === document.activeElement);

  if (focusables.length === 0) return;

  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];

  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    boton.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

/**
 * Controla el menú desplegable de pantallas pequeñas.
 * El menú se muestra como un panel flotante bajo el encabezado: se superpone
 * al contenido con un borde redondeado y nunca empuja el resto de la página.
 *
 * El botón lleva su nombre accesible en el HTML (`aria-label`) porque por
 * debajo de 375 px la hoja de estilos oculta el rótulo «Menú» con
 * `display: none` y el icono va marcado como decorativo: sin ese atributo el
 * botón se anunciaría solo como «botón». Aquí el nombre se sincroniza con el
 * estado, para que al leer `aria-expanded` no haya contradicción con lo que
 * anuncia (WCAG 2.2 SC 4.1.2).
 */
function iniciarMenuMovil() {
  const boton = select('[data-menu-boton]');
  const menu = select('[data-menu]');
  if (!boton || !menu) return;

  const abrir = () => {
    boton.setAttribute('aria-expanded', 'true');
    boton.setAttribute('aria-label', 'Cerrar menú de navegación');
    menu.classList.add('pf-menu-abierto');
  };

  const cerrar = ({ devolverFoco = false } = {}) => {
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú de navegación');
    menu.classList.remove('pf-menu-abierto');
    if (devolverFoco) boton.focus();
  };

  const estaAbierto = () => boton.getAttribute('aria-expanded') === 'true';

  boton.addEventListener('click', () => (estaAbierto() ? cerrar() : abrir()));

  // Al navegar a una sección el menú se cierra solo.
  menu.addEventListener('click', (evento) => {
    if (evento.target.closest('a')) cerrar();
  });

  // Un clic fuera del panel (o en el propio botón) cierra el menú.
  document.addEventListener('click', (evento) => {
    if (!estaAbierto()) return;
    if (evento.target.closest('[data-menu]') || evento.target.closest('[data-menu-boton]')) return;
    cerrar();
  });

  // Escape cierra el menú y devuelve el foco al botón que lo abrió.
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && estaAbierto()) {
      evento.preventDefault();
      cerrar({ devolverFoco: true });
      return;
    }

    // Tab cicla entre el botón y los enlaces del menú, nunca hacia el fondo.
    if (evento.key === 'Tab' && estaAbierto()) {
      confinarFocoEnMenu(menu, boton, evento);
    }
  });

  // Al volver a una pantalla ancha el menú debe quedar cerrado.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (evento) => {
    if (evento.matches) cerrar();
  });
}

/**
 * Añade una sombra y un fondo más sólido al encabezado cuando la página
 * se ha desplazado. El cambio es intencionalmente sutil.
 */
function iniciarEncabezadoFijo() {
  const encabezado = select('.pf-encabezado');
  if (!encabezado) return;

  let programado = false;
  const actualizar = () => {
    programado = false;
    encabezado.dataset.fijo = String(window.scrollY > 8);
  };

  window.addEventListener('scroll', () => {
    if (programado) return;
    programado = true;
    requestAnimationFrame(actualizar);
  }, { passive: true });

  actualizar();
}

/** Botón de cierre de sesión presente en las páginas del cliente. */
function iniciarCierreSesion() {
  selectTodos('[data-cerrar-sesion]').forEach((boton) => {
    boton.addEventListener('click', () => {
      cerrarSesion();
      actualizarEstadoSesion(null);
      actualizarContadorCarrito();
      mostrarAviso('Sesión cerrada correctamente.', 'exito');
    });
  });
}

/** Escribe el año actual en el pie de página. */
function iniciarAnioActual() {
  selectTodos('[data-anio]').forEach((elemento) => {
    elemento.textContent = new Date().getFullYear();
  });
}

/** Muestra la marca de última actualización del catálogo donde está presente. */
function iniciarMarcaActualizacion() {
  selectTodos('[data-ultima-actualizacion]').forEach((elemento) => {
    const marca = leerActualizacion() || registrarActualizacion();
    elemento.textContent = `Catálogo actualizado: ${formatearFecha(marca)}`;
  });
}

/** Muestra el estado de carga dentro de un contenedor con aria-busy. */
function marcarCarga(contenedor, cargando = true) {
  if (!contenedor) return;
  contenedor.setAttribute('aria-busy', String(cargando));

  if (cargando) {
    contenedor.innerHTML = '<p class="pf-cargando">Cargando información...</p>';
  }
}

/** Publica un resultado de carga en la región de mensajes de la página. */
function informarCarga(region, resultado) {
  if (!region) return;
  const tipo = resultado.origen === 'indexeddb' ? 'info' : 'exito';
  mostrarMensaje(region, resultado.mensaje, tipo);
}

/** Inicializa todo lo que no depende de la página concreta. */
function iniciarComunes() {
  iniciarAvisoCookies();
  iniciarMenuMovil();
  iniciarEncabezadoFijo();
  iniciarCierreSesion();
  iniciarAnioActual();
  iniciarMarcaActualizacion();
  // El carrito es un panel lateral disponible en todas las páginas.
  iniciarPanelCarrito();
  actualizarContadorCarrito();
  actualizarEstadoSesion(usuarioActual());
}

/* =========================================================
   2. Páginas públicas (index.html y las secciones de cliente/)
   ========================================================= */

/** Rellena los datos fijos del gimnasio (dirección, correo y horarios). */
async function pintarDatosGimnasio() {
  try {
    const datos = await obtenerGimnasio();
    const gimnasio = datos.gimnasio;

    selectTodos('[data-gimnasio-direccion]').forEach((nodo) => (nodo.textContent = gimnasio.direccion));
    selectTodos('[data-gimnasio-correo]').forEach((nodo) => {
      nodo.textContent = gimnasio.correo;
      if (nodo.tagName === 'A') nodo.href = `mailto:${gimnasio.correo}`;
    });

    const lista = select('[data-gimnasio-horarios]');
    if (lista) {
      lista.innerHTML = gimnasio.horarios
        .map(
          (horario) => `
            <li class="flex items-center justify-between gap-3 border-b border-pf-linea py-2">
              <span class="font-semibold text-white">${escapar(horario.dias)}</span>
              <span class="text-neutral-300">
                ${
                  horario.horaInicio
                    ? `${escapar(horario.horaInicio)} – ${escapar(horario.horaFin)}`
                    : 'Cerrado'
                }
              </span>
            </li>`
        )
        .join('');
    }

    const servicios = select('[data-servicios]');
    if (servicios) {
      renderizar(servicios, datos.servicios.map(tarjetaServicio));
    }

    const niveles = select('[data-niveles]');
    if (niveles) {
      niveles.innerHTML = datos.niveles
        .map(
          (nivel, indice) => `
            <li class="flex items-center gap-3 rounded-lg border border-pf-linea bg-pf-grafito p-3">
              <span aria-hidden="true" class="flex h-8 w-8 items-center justify-center rounded-full bg-pf-amarillo font-bold text-pf-negro">${
            indice + 1
          }</span>
              <span class="font-semibold text-white">${escapar(nivel)}</span>
            </li>`
        )
        .join('');
    }
  } catch (error) {
    console.error('No se pudieron cargar los datos del gimnasio:', error);
  }
}

/** Formulario de contacto de cliente/contacto.html. */
function iniciarFormularioContacto() {
  const formulario = select('#formulario-contacto');
  if (!formulario) return;

  const region = select('#mensaje-contacto');

  construirValidador(formulario, {
    reglas: {
      nombre: validarNombre,
      telefono: validarTelefono
    },
    alEnviar: async () => {
      const datos = Object.fromEntries(new FormData(formulario));
      const mensajes = leerLocal('mensajesContacto', []);
      mensajes.push({ ...datos, fecha: new Date().toISOString() });
      escribirLocal('mensajesContacto', mensajes);

      formulario.reset();
      mostrarMensaje(region, 'Mensaje enviado. Nos pondremos en contacto contigo pronto.', 'exito');
    }
  });
}

/**
 * Páginas públicas del sitio multipágina.
 *
 * Cada sección del menú es su propio archivo HTML (index.html y
 * cliente/planes.html, tienda.html, clases.html, rutinas.html,
 * contacto.html). Todas rellenan los datos del gimnasio que aparecen en el
 * pie y, además, dibujan solo el contenido de su página.
 */

/** Inicio: hero y tarjetas de acceso a cada página. */
async function iniciarPaginaInicio() {
  await pintarDatosGimnasio();
}

/** Planes: catálogo de planes y «Cómo elegir tu plan». */
async function iniciarPaginaPlanes() {
  await pintarDatosGimnasio();
  await pintarPlanes(select('#mensaje-dinamico'));
}

/** Tienda: productos agrupados por categoría. */
async function iniciarPaginaTienda() {
  await pintarDatosGimnasio();
  await pintarCatalogoProductos(select('#mensaje-dinamico'));
}

/** Clases: tarjetas de cada actividad y entrenadores. */
async function iniciarPaginaClases() {
  await pintarDatosGimnasio();
  await pintarClases(select('#mensaje-dinamico'));
}

/** Rutinas: niveles y servicios (vienen de gimnasio.json). */
async function iniciarPaginaRutinas() {
  await pintarDatosGimnasio();
}

/** Contacto: dirección, horarios y formulario con sus validaciones. */
async function iniciarPaginaContacto() {
  iniciarFormularioContacto();
  await pintarDatosGimnasio();
}

/* =========================================================
   3. Planes
   ========================================================= */

/** Pinta el catálogo de planes y conecta el botón "Elegir plan". */
async function pintarPlanes(region) {
  const contenedor = select('[data-planes]');
  if (!contenedor) return;

  marcarCarga(contenedor);
  const resultado = await obtenerPlanes();
  estadoPlanes = resultado.datos;

  renderizar(
    contenedor,
    resultado.datos.length ? resultado.datos.map(tarjetaPlan) : [vacio('No hay planes disponibles.')]
  );
  informarCarga(region, resultado);
  iniciarCarritoPlanes(contenedor);
}

/** Planes cargados del repositorio, para resolver imagen y nombre al agregar. */
let estadoPlanes = [];

/**
 * "Elegir plan" agrega el plan al carrito, igual que un producto.
 * No pide sesión: el acceso se solicita al finalizar la compra.
 * El id se prefija con "plan-" porque los productos usan ids numéricos
 * y sin el prefijo un plan y un producto con el mismo id colisionarían.
 */
function iniciarCarritoPlanes(contenedor) {
  if (!contenedor) return;

  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion="elegir-plan"]');
    if (!boton) return;

    const idOriginal = boton.dataset.planId;
    const delJson = estadoPlanes.find((plan) => String(plan.id) === String(idOriginal));

    const plan = {
      id: `plan-${idOriginal}`,
      nombre: boton.dataset.planNombre || delJson?.nombre || 'Plan',
      precio: Number(boton.dataset.planPrecio || delJson?.precio || 0),
      imagen: delJson?.imagen || '',
      tipo: 'plan'
    };

    carrito.agregar(plan, 1);
    actualizarContadorCarrito();

    const tarjeta = boton.closest('[data-plan]');
    tarjeta?.classList.add('pf-confirmacion');
    window.setTimeout(() => tarjeta?.classList.remove('pf-confirmacion'), 350);

    mostrarAviso(`${plan.nombre} agregado al carrito.`, 'exito');
    panelCarrito.abrir();
  });
}

/** Registra el plan contratado en el almacenamiento local del cliente. */
function registrarSuscripcion(plan) {
  const usuario = usuarioActual();
  if (!usuario) return;

  const clave = `suscripcion-${usuario.id}`;
  escribirLocal(clave, {
    plan,
    fecha: new Date().toISOString(),
    usuario: { id: usuario.id, nombre: usuario.nombre }
  });
}

/* =========================================================
   4. Clases
   ========================================================= */

/** Pinta las tarjetas de cada actividad (con sus horarios) y los entrenadores. */
async function pintarClases(region) {
  const contenedor = select('[data-clases]');
  const listaEntrenadores = select('[data-entrenadores]');

  if (!contenedor && !listaEntrenadores) return;
  if (contenedor) marcarCarga(contenedor);

  const [clases, entrenadores] = await Promise.all([obtenerClases(), obtenerEntrenadores()]);
  const porId = new Map(entrenadores.datos.map((entrenador) => [entrenador.id, entrenador]));

  if (contenedor) {
    renderizar(
      contenedor,
      clases.datos.length
        ? clases.datos.map((clase) => tarjetaClase(clase, porId.get(clase.entrenadorId)))
        : [vacio('No hay clases programadas.')]
    );
    contenedor.setAttribute('aria-busy', 'false');
    informarCarga(region, clases);
  }

  if (listaEntrenadores) {
    renderizar(
      listaEntrenadores,
      entrenadores.datos.length
        ? entrenadores.datos.map(tarjetaEntrenador)
        : [vacio('No hay entrenadores registrados.')]
    );
  }
}

/* =========================================================
   5. Catálogo de productos (organizado por categorías)
   ========================================================= */

/** Productos originales cargados desde el JSON. */
const estadoCatalogo = { productos: [] };

/** Orden preferido de las categorías; las no listadas van después. */
const ORDEN_CATEGORIAS = ['Suplementos', 'Ropa', 'Accesorios'];

/** Agrupa los productos por categoría respetando el orden preferido. */
function agruparPorCategoria(productos) {
  const grupos = new Map();
  productos.forEach((producto) => {
    const categoria = producto.categoria || 'Otros';
    if (!grupos.has(categoria)) grupos.set(categoria, []);
    grupos.get(categoria).push(producto);
  });

  return [...grupos.entries()]
    .map(([categoria, lista]) => ({ categoria, productos: lista }))
    .sort((a, b) => {
      const ia = ORDEN_CATEGORIAS.indexOf(a.categoria);
      const ib = ORDEN_CATEGORIAS.indexOf(b.categoria);
      const posicion = (indice) => (indice === -1 ? ORDEN_CATEGORIAS.length : indice);
      return posicion(ia) - posicion(ib) || a.categoria.localeCompare(b.categoria, 'es');
    });
}

/** Dibuja una sección por cada categoría, cada una con su propia cuadrícula. */
function pintarCategoriasTienda(contenedor) {
  const grupos = agruparPorCategoria(estadoCatalogo.productos);
  renderizar(
    contenedor,
    grupos.length ? grupos.map(seccionCategoriaTienda) : [vacio('No hay productos disponibles por ahora.')]
  );
  contenedor.setAttribute('aria-busy', 'false');

  const region = select('#mensaje-catalogo');
  const total = estadoCatalogo.productos.length;
  if (region) {
    mostrarMensaje(
      region,
      `${total} producto${total === 1 ? '' : 's'} en ${grupos.length} categoría${grupos.length === 1 ? '' : 's'}.`,
      'info'
    );
  }
}

/** Agrega un producto al carrito desde cualquier listado de tarjetas. */
function iniciarCarritoDesdeListado(contenedor) {
  if (!contenedor) return;

  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion="agregar"]');
    if (!boton) return;

    const id = Number(boton.dataset.id);
    const producto = estadoCatalogo.productos.find((item) => item.id === id);
    if (!producto) return;

    carrito.agregar(producto, 1);
    actualizarContadorCarrito();

    // Confirmación breve en la tarjeta, sin mover el foco.
    const tarjeta = boton.closest('[data-producto]');
    tarjeta?.classList.add('pf-confirmacion');
    window.setTimeout(() => tarjeta?.classList.remove('pf-confirmacion'), 350);

    // Se anuncia con la región aria-live de la página: agregar no pide login.
    mostrarAviso('Producto agregado al carrito.', 'exito');
  });
}

/** Pinta el catálogo agrupado por categorías y activa "Agregar al carrito". */
async function pintarCatalogoProductos(region) {
  const contenedor = select('[data-catalogo]');
  if (!contenedor) return;

  marcarCarga(contenedor);
  const resultado = await obtenerProductos();
  estadoCatalogo.productos = resultado.datos;

  pintarCategoriasTienda(contenedor);
  informarCarga(region, resultado);
  iniciarCarritoDesdeListado(contenedor);
}

/* =========================================================
   6. Checkout: datos del cliente, resumen y confirmación
   ========================================================= */

/** Dibuja el resumen del pedido en el checkout. */
function pintarResumenCheckout(contenedor, items, total) {
  if (!contenedor) return;

  contenedor.innerHTML = items
    .map(
      (item) => `
      <li class="flex items-center justify-between gap-3 border-b border-pf-linea py-2">
        <span class="text-neutral-300">${escapar(item.nombre)} <span class="text-pf-amarillo">x${escapar(
        item.cantidad
      )}</span></span>
        <span class="font-bold text-white">${formatearPrecio(item.precio * item.cantidad)}</span>
      </li>`
    )
    .join('');

  const nodoTotal = select('[data-checkout-total]');
  if (nodoTotal) nodoTotal.textContent = formatearPrecio(total);
}

async function iniciarPaginaCheckout() {
  const region = select('#mensaje-dinamico');
  const usuario = usuarioActual();

  // Sin sesión se vuelve al login conservando el carrito intacto.
  if (!usuario) {
    guardarPendencia('carrito', { articulos: carrito.contar() });
    mostrarAviso('Inicia sesión para finalizar tu compra. Tu carrito se conserva.', 'info');
    window.location.href = new URL('cliente/login.html?origen=carrito', raizSitio()).href;
    return;
  }

  const items = carrito.obtener();

  if (items.length === 0) {
    select('[data-checkout-formulario]')?.setAttribute('hidden', '');
    select('[data-checkout-vacio]')?.removeAttribute('hidden');
    mostrarMensaje(region, 'Tu carrito está vacío: agrega productos antes de finalizar la compra.', 'info');
    return;
  }

  select('[data-checkout-vacio]')?.setAttribute('hidden', '');
  pintarResumenCheckout(select('[data-checkout-resumen]'), items, carrito.total());

  const formulario = select('#formulario-checkout');
  if (!formulario) return;

  // Los datos de la sesión cambian el checkout sin tener que escribirlos.
  const nombre = formulario.querySelector('#nombre');
  const correo = formulario.querySelector('#correo');
  if (nombre && !nombre.value) nombre.value = usuario.nombre || '';
  if (correo && !correo.value) correo.value = usuario.correo || '';

  construirValidador(formulario, {
    reglas: {
      nombre: validarNombre,
      telefono: validarTelefono
    },
    alEnviar: async () => {
      const datos = Object.fromEntries(new FormData(formulario));
      const pedido = {
        id: generarIdPedido(),
        fecha: new Date().toISOString(),
        cliente: {
          nombre: datos.nombre,
          correo: datos.correo,
          telefono: datos.telefono
        },
        productos: items.map((item) => ({ ...item })),
        total: carrito.total(),
        estado: 'Confirmado',
        retiro: 'Avenida San Rio de Janeiro y Panamá, Quito, Ecuador'
      };

      // El pedido queda registrado en localStorage y replicado en IndexedDB.
      const pedidos = leerLocal(CLAVES.pedidos, []);
      escribirLocal(CLAVES.pedidos, [...pedidos, pedido]);
      await guardarRegistro(ALMACENES.pedidos, pedido).catch(() => {});

      // Un plan comprado queda además como suscripción del cliente.
      items
        .filter((item) => item.tipo === 'plan')
        .forEach((item) =>
          registrarSuscripcion({ id: item.id, nombre: item.nombre, precio: item.precio })
        );

      // Solo después de confirmar se vacía el carrito.
      carrito.vaciar();

      formulario.setAttribute('hidden', '');
      select('[data-checkout-resumen]')?.closest('[data-checkout-bloque]')?.setAttribute('hidden', '');
      const confirmacion = select('[data-checkout-confirmacion]');
      confirmacion?.removeAttribute('hidden');
      select('[data-confirmacion-resumen]').innerHTML = `
        <li class="flex items-center justify-between gap-3 border-b border-pf-linea py-2">
          <span class="font-bold text-white">Código del pedido</span>
          <span class="font-mono text-pf-amarillo">${escapar(pedido.id)}</span>
        </li>
        ${pedido.productos
          .map(
            (item) => `
          <li class="flex items-center justify-between gap-3 border-b border-pf-linea py-2">
            <span class="text-neutral-300">${escapar(item.nombre)} <span class="text-pf-amarillo">x${escapar(
              item.cantidad
            )}</span></span>
            <span class="font-bold text-white">${formatearPrecio(item.precio * item.cantidad)}</span>
          </li>`
          )
          .join('')}
        <li class="flex items-center justify-between gap-3 py-2">
          <span class="font-bold text-white">Total</span>
          <span class="text-xl font-extrabold text-pf-amarillo">${formatearPrecio(pedido.total)}</span>
        </li>`;

      mostrarMensaje(
        region,
        `¡Pedido registrado correctamente! Retíralo en ${pedido.retiro}.`,
        'exito'
      );
      confirmacion?.scrollIntoView({ block: 'start' });
      confirmacion?.querySelector('h2')?.setAttribute('tabindex', '-1');
      confirmacion?.querySelector('h2')?.focus();
    }
  });
}

/* =========================================================
   7. Solicitud de cita de nutrición
   ========================================================= */

function iniciarPaginaNutricion() {
  const formulario = select('#formulario-nutricion');
  if (!formulario) return;

  const region = select('#mensaje-nutricion');

  // El servicio de asesoría nutricional no tiene precio definido:
  // solo se informa que requiere cita.
  construirValidador(formulario, {
    reglas: {
      nombre: validarNombre,
      cedula: validarCedula,
      telefono: validarTelefono,
      fecha: validarFechaFutura
    },
    alEnviar: async () => {
      const usuario = usuarioActual();
      const datos = Object.fromEntries(new FormData(formulario));

      const cita = {
        id: generarIdCita(),
        ...datos,
        usuario: usuario ? { id: usuario.id, nombre: usuario.nombre } : { nombre: datos.nombre },
        estado: 'Solicitada',
        creada: new Date().toISOString()
      };

      // La lista vive en localStorage y se replica en IndexedDB.
      const citas = leerLocal(CLAVES.citasNutricion, []);
      citas.push(cita);
      escribirLocal(CLAVES.citasNutricion, citas);
      await guardarRegistro(ALMACENES.citas, cita).catch(() => {});

      formulario.reset();
      mostrarMensaje(
        region,
        `Cita solicitada para el ${cita.fecha}. El precio de la asesoría nutricional se consulta en el gimnasio.`,
        'exito'
      );
    }
  });

  // Prellena los datos del usuario si ya tiene sesión.
  if (usuarioActual()) {
    const usuario = usuarioActual();
    const nombre = formulario.querySelector('#nombre');
    const telefono = formulario.querySelector('#telefono');
    const correo = formulario.querySelector('#correo');
    if (nombre && !nombre.value) nombre.value = usuario.nombre;
    if (correo && !correo.value) correo.value = usuario.correo;
    if (telefono && !telefono.value) telefono.value = '0991234567';
  }
}

/* =========================================================
   8. Inicio de sesión y registro de clientes
   ========================================================= */

function iniciarPaginaLogin() {
  const formulario = select('#formulario-login');
  const region = select('#mensaje-login');
  const avisoRegistro = select('#aviso-registro');

  if (avisoRegistro) {
    const origen = new URLSearchParams(window.location.search).get('origen');
    if (origen === 'planes') {
      mostrarMensaje(
        avisoRegistro,
        'Para contratar un plan necesitas iniciar sesión. Tus datos de prueba están en el formulario.',
        'info'
      );
    } else if (origen === 'carrito') {
      mostrarMensaje(avisoRegistro, 'Inicia sesión para continuar con tu compra.', 'info');
    }
  }

  if (formulario) {
    construirValidador(formulario, {
      reglas: {
        correo: (campo) => campo.value.trim().length > 3
      },
      alEnviar: async () => {
        const correo = formulario.querySelector('#correo').value;
        const contrasena = formulario.querySelector('#contrasena').value;
        const resultado = await iniciarSesion(correo, contrasena, 'cliente');

        if (!resultado.ok) {
          mostrarMensaje(region, resultado.mensaje, 'error');
          return;
        }

        mostrarMensaje(region, resultado.mensaje, 'exito');
        actualizarEstadoSesion(resultado.usuario);

        // Continúa la compra si quedó pendiente tras iniciar sesión.
        window.setTimeout(() => {
          if (tienePendencia('carrito')) {
            window.location.href = new URL('cliente/checkout.html', raizSitio()).href;
          } else {
            window.location.href = new URL('index.html', raizSitio()).href;
          }
        }, 900);
      }
    });
  }

  // Registro de un nuevo cliente (queda en el navegador, sin servidor).
  const formularioRegistro = select('#formulario-registro');
  if (formularioRegistro) {
    construirValidador(formularioRegistro, {
      reglas: {
        'nombre-registro': validarNombre,
        'cedula-registro': validarCedula,
        'telefono-registro': validarTelefono,
        'contrasena-registro': validarContrasena,
        confirmar: (campo) => {
          const original = formularioRegistro.querySelector('#contrasena-registro');
          return validarCoincidencia(campo, original);
        }
      },
      alEnviar: async () => {
        const datos = Object.fromEntries(new FormData(formularioRegistro));

        if (existeRegistroLocal(datos.correo)) {
          mostrarMensaje(
            select('#mensaje-registro'),
            'Ya existe un registro local con ese correo. Intenta iniciar sesión.',
            'error'
          );
          return;
        }

        await registrarCliente({
          nombre: datos.nombre,
          cedula: datos.cedula,
          telefono: datos.telefono,
          correo: datos.correo,
          nivel: datos.nivel,
          contrasena: datos.contrasena
        });

        formularioRegistro.reset();
        mostrarMensaje(
          select('#mensaje-registro'),
          'Registro creado en este navegador. Ya puedes iniciar sesión con tus datos.',
          'exito'
        );
      }
    });
  }

  /* La pendiente se conserva: la consume la página de destino. */
}

/* =========================================================
   9. Enrutador de páginas del cliente
   ========================================================= */

/**
 * Controladores disponibles, uno por cada `data-pagina`.
 * El sitio es multipágina: cada sección del menú tiene su archivo HTML
 * y su propio controlador.
 */
const PAGINAS = {
  inicio: iniciarPaginaInicio,
  planes: iniciarPaginaPlanes,
  tienda: iniciarPaginaTienda,
  clases: iniciarPaginaClases,
  rutinas: iniciarPaginaRutinas,
  contacto: iniciarPaginaContacto,
  checkout: iniciarPaginaCheckout,
  nutricion: iniciarPaginaNutricion,
  login: iniciarPaginaLogin
};

document.addEventListener('DOMContentLoaded', () => {
  iniciarComunes();

  const pagina = document.body.dataset.pagina;
  const controlador = PAGINAS[pagina];

  if (!controlador) {
    console.warn(`No hay controlador registrado para la página "${pagina}".`);
    return;
  }

  controlador();
});
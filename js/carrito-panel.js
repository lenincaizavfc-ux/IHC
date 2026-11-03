/**
 * carrito-panel.js - Panel lateral del carrito y modal de acceso.
 *
 * El carrito deja de ser una página: se presenta como un panel lateral
 * (drawer) disponible en todas las páginas del área cliente. El flujo de
 * compra es académico y funciona sin servidor:
 *
 *   producto -> agregar (sin login) -> localStorage -> panel lateral
 *            -> finalizar compra -> ¿hay sesión? -> modal de acceso
 *            -> checkout -> confirmación
 *
 * Al pedir el acceso nunca se vacía el carrito: la selección se conserva
 * tal cual en localStorage mientras la persona inicia sesión.
 */

import { carrito, formatearPrecio, esPlan, CANTIDAD_MAXIMA } from './cart.js';
import { iniciarSesion, haySesion } from './auth.js';
import { construirValidador } from './validation.js';
import { escapar, rutaArchivo, mostrarAviso, actualizarContadorCarrito } from './view.js';
import { raizSitio } from './storage.js';

/** Último elemento que tenía el foco, para devolverlo al cerrar. */
let focoAnterior = null;

/* =========================================================
   Estructura del panel y del modal
   ========================================================= */

/** Inserta el panel lateral y el modal de acceso si todavía no existen. */
function inyectarEstructura() {
  if (document.querySelector('[data-panel-carrito]')) return;

  // Las rutas absolutas del sitio evitan que los enlaces del panel se
  // resuelvan mal dentro de /cliente/. El catálogo tiene su propia
  // página, así que "seguir comprando" vuelve a cliente/tienda.html.
  const tienda = new URL('cliente/tienda.html', raizSitio()).href;
  const registro = new URL('cliente/login.html#registro', raizSitio()).href;

  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="pf-capa" data-capa-carrito data-visible="false"></div>

    <aside
      class="pf-panel"
      id="panel-carrito"
      data-panel-carrito
      data-visible="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-panel-carrito">
      <div class="pf-panel-cabecera">
        <h2 id="titulo-panel-carrito">
          Carrito
          <span class="text-pf-amarillo" data-panel-articulos>(0)</span>
        </h2>
        <button type="button" class="pf-panel-cerrar" data-cerrar-carrito aria-label="Cerrar el carrito">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <div class="pf-panel-cuerpo">
        <div data-panel-vacio-state hidden>
          <p class="m-0 font-bold text-white">Tu carrito está vacío</p>
          <p class="mt-2 text-sm text-neutral-300">
            Agrega productos desde la tienda: puedes hacerlo sin iniciar sesión.
          </p>
          <a href="${escapar(tienda)}" class="pf-boton pf-boton-primario mt-4 w-full">Ver productos</a>
        </div>
        <ul class="m-0 list-none p-0" data-panel-lineas></ul>
      </div>

      <div class="pf-panel-pie">
        <dl class="m-0">
          <div class="pf-total-bloque">
            <dt>Subtotal</dt>
            <dd data-panel-subtotal>$0.00</dd>
          </div>
          <div class="pf-total-bloque pf-total-final">
            <dt>Total</dt>
            <dd data-panel-total>$0.00</dd>
          </div>
        </dl>
        <p class="mt-2 text-xs text-neutral-400">
          Retiro en el gimnasio. El proyecto es frontend: no hay pago en línea.
        </p>
        <button type="button" class="pf-boton pf-boton-secundario mt-4 w-full" data-panel-vaciar>
          Vaciar carrito
        </button>
        <button type="button" class="pf-boton pf-boton-primario mt-3 w-full" data-panel-finalizar>
          Finalizar compra
        </button>
        <button type="button" class="pf-boton pf-boton-enlace mt-2 w-full" data-panel-continuar>
          Continuar comprando
        </button>
      </div>
    </aside>

    <div class="pf-capa" data-capa-acceso data-visible="false"></div>

    <div
      class="pf-modal"
      id="modal-acceso"
      data-modal-acceso
      data-visible="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-acceso">
      <div class="pf-modal-cabecera">
        <h2 id="titulo-modal-acceso">Inicia sesión</h2>
        <button type="button" class="pf-panel-cerrar" data-cerrar-acceso aria-label="Cerrar el inicio de sesión">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <form class="space-y-4 p-5" data-formulario-acceso novalidate>
        <p class="m-0 text-sm text-neutral-300">
          Para finalizar tu compra necesitas iniciar sesión. Tu carrito se conserva mientras te autenticas.
        </p>

        <div>
          <label class="block font-bold text-white" for="acceso-correo">Correo</label>
          <input
            class="mt-1 w-full rounded-lg border border-pf-linea p-2"
            type="email"
            id="acceso-correo"
            name="correo"
            required
            autocomplete="email"
            aria-describedby="ayuda-acceso-correo">
          <p class="mt-1 text-xs text-neutral-400" id="ayuda-acceso-correo">
            Usa el correo con el que te registraste.
          </p>
        </div>

        <div>
          <label class="block font-bold text-white" for="acceso-contrasena">Contraseña</label>
          <input
            class="mt-1 w-full rounded-lg border border-pf-linea p-2"
            type="password"
            id="acceso-contrasena"
            name="contrasena"
            required
            minlength="6"
            maxlength="40"
            autocomplete="current-password"
            aria-describedby="ayuda-acceso-contrasena">
          <p class="mt-1 text-xs text-neutral-400" id="ayuda-acceso-contrasena">Entre 6 y 40 caracteres.</p>
        </div>

        <p class="pf-mensaje m-0 text-sm" data-mensaje-acceso role="status" aria-live="polite" hidden></p>

        <button type="submit" class="pf-boton pf-boton-primario w-full">Iniciar sesión</button>

        <p class="m-0 text-sm text-neutral-300">
          ¿No tienes cuenta?
          <a href="${escapar(registro)}" class="font-bold text-pf-amarillo underline">Crear cuenta</a>
        </p>
      </form>
    </div>`
  );
}

/* =========================================================
   Pintado del panel
   ========================================================= */

/** Describe el tipo de la línea para que productos y planes no se confundan. */
function etiquetaTipo(item) {
  return esPlan(item) ? 'Plan mensual' : 'Producto';
}

/**
 * Botones de cantidad de una línea. Un plan es una suscripción mensual y no
 * admite más de una unidad, así que en ese caso solo se muestra el valor.
 */
function controlCantidad(item) {
  const nombre = escapar(item.nombre);

  if (esPlan(item)) {
    return `
            <span class="pf-cantidad">
              <output aria-label="Cantidad de ${nombre}">${escapar(item.cantidad)}</output>
            </span>`;
  }

  return `
            <span class="pf-cantidad">
              <button type="button" data-restar="${escapar(item.id)}" aria-label="Disminuir la cantidad de ${nombre}">
                <span aria-hidden="true">&minus;</span>
              </button>
              <output aria-label="Cantidad de ${nombre}">${escapar(item.cantidad)}</output>
              <button type="button" data-sumar="${escapar(item.id)}" aria-label="Aumentar la cantidad de ${nombre}">
                <span aria-hidden="true">+</span>
              </button>
            </span>`;
}

/** Dibuja las líneas del carrito, el subtotal y el total dentro del panel. */
function pintarPanel() {
  const lista = document.querySelector('[data-panel-lineas]');
  if (!lista) return;

  const items = carrito.obtener();
  const articulos = carrito.contar();

  const vacio = document.querySelector('[data-panel-vacio-state]');
  if (vacio) vacio.hidden = items.length > 0;

  lista.innerHTML = items
    .map(
      (item) => `
      <li class="pf-linea" data-linea-panel="${escapar(item.id)}">
        ${
          item.imagen
            ? `<img src="${escapar(rutaArchivo(item.imagen))}" alt="${escapar(item.nombre)}" width="64" height="64">`
            : `<span class="pf-linea-sin-imagen" aria-hidden="true">${escapar(
                (item.nombre || '?').charAt(0).toUpperCase()
              )}</span>`
        }
        <div class="pf-linea-detalle">
          <p class="m-0 font-bold text-white">${escapar(item.nombre)}</p>
          <p class="m-0 text-sm text-neutral-400">${escapar(etiquetaTipo(item))} ${formatearPrecio(
        item.precio
      )} c/u</p>
          <div class="pf-linea-precios">${controlCantidad(item)}
            <span class="pf-precio">${formatearPrecio(item.precio * item.cantidad)}</span>
          </div>
          <button type="button" class="pf-quitar" data-quitar="${escapar(item.id)}">
            Eliminar del carrito
          </button>
        </div>
      </li>`
    )
    .join('');

  const etiqueta = document.querySelector('[data-panel-articulos]');
  if (etiqueta) {
    etiqueta.textContent = `(${articulos})`;
  }

  const subtotal = carrito.subtotal();
  const nodoSubtotal = document.querySelector('[data-panel-subtotal]');
  const nodoTotal = document.querySelector('[data-panel-total]');
  if (nodoSubtotal) nodoSubtotal.textContent = formatearPrecio(subtotal);
  if (nodoTotal) nodoTotal.textContent = formatearPrecio(carrito.total());

  actualizarContadorCarrito(articulos);
}

/* =========================================================
   Apertura, cierre y foco
   ========================================================= */

/** Marca una capa como visible o oculta y sincroniza el overlay. */
function alternarCapa(nodo, visible) {
  if (!nodo) return;
  nodo.dataset.visible = String(visible);
  nodo.setAttribute('aria-hidden', String(!visible));
}

function estaAbierto(nodo) {
  return nodo?.dataset.visible === 'true';
}

/**
 * Enfoca un elemento de un diálogo recién abierto.
 *
 * El panel y el modal se muestran con una transición de `visibility`: mientras
 * dura, el navegador los sigue considerando ocultos y `focus()` sobre un
 * elemento invisible se descarta en silencio. Por eso no basta con pedir el
 * foco en el siguiente fotograma: si el estilo aún no se ha calculado, la
 * llamada se pierde y el teclado se queda en la página de fondo.
 *
 * Se reintenta un fotograma tras otro hasta que el foco entra de verdad o se
 * agotan los intentos, de modo que el diálogo abierto siempre recibe el foco
 * (WCAG 2.2 SC 2.4.3) sin depender del ritmo de refresco de cada equipo.
 */
function enfocarEnDialogo(elemento, intentos = 40) {
  if (!elemento) return;
  let restantes = intentos;

  const intentar = () => {
    elemento.focus();
    if (document.activeElement === elemento || restantes <= 1) return;
    restantes -= 1;
    requestAnimationFrame(intentar);
  };

  requestAnimationFrame(intentar);
}

function abrirPanel() {
  const panel = document.querySelector('[data-panel-carrito]');
  if (!panel) return;

  focoAnterior = document.activeElement;
  pintarPanel();
  alternarCapa(panel, true);
  alternarCapa(document.querySelector('[data-capa-carrito]'), true);
  document.body.classList.add('pf-bloquea-scroll');

  document.querySelectorAll('[data-abrir-carrito]').forEach((boton) => {
    boton.setAttribute('aria-expanded', 'true');
  });

  enfocarEnDialogo(panel.querySelector('[data-cerrar-carrito]'));
}

function cerrarPanel({ devolverFoco = true } = {}) {
  const panel = document.querySelector('[data-panel-carrito]');
  if (!panel || !estaAbierto(panel)) return;

  alternarCapa(panel, false);
  alternarCapa(document.querySelector('[data-capa-carrito]'), false);
  document.body.classList.remove('pf-bloquea-scroll');

  document.querySelectorAll('[data-abrir-carrito]').forEach((boton) => {
    boton.setAttribute('aria-expanded', 'false');
  });

  if (devolverFoco && focoAnterior instanceof HTMLElement) focoAnterior.focus();
}

function abrirModalAcceso() {
  const modal = document.querySelector('[data-modal-acceso]');
  if (!modal) return;

  if (!estaAbierto(modal)) focoAnterior = document.activeElement;
  alternarCapa(modal, true);
  alternarCapa(document.querySelector('[data-capa-acceso]'), true);
  document.body.classList.add('pf-bloquea-scroll');
  enfocarEnDialogo(modal.querySelector('#acceso-correo'));
}

function cerrarModalAcceso({ devolverFoco = true } = {}) {
  const modal = document.querySelector('[data-modal-acceso]');
  if (!modal || !estaAbierto(modal)) return;

  alternarCapa(modal, false);
  alternarCapa(document.querySelector('[data-capa-acceso]'), false);

  const panelAbierto = estaAbierto(document.querySelector('[data-panel-carrito]'));
  if (!panelAbierto) document.body.classList.remove('pf-bloquea-scroll');

  if (devolverFoco && focoAnterior instanceof HTMLElement) focoAnterior.focus();
}

/** Mantiene el foco dentro del diálogo abierto (comportamiento de modal). */
function confinarFoco(contenedor, evento) {
  const focusables = [
    ...contenedor.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter((nodo) => nodo.offsetParent !== null || nodo === document.activeElement);

  if (focusables.length === 0) return;
  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];

  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

/* =========================================================
   Flujo de compra
   ========================================================= */

/**
 * "Finalizar compra": exige sesión. Sin sesión se abre el modal de acceso
 * y el carrito se conserva exactamente igual.
 */
function finalizarCompra() {
  if (carrito.contar() === 0) {
    mostrarAviso('Agrega productos al carrito antes de finalizar la compra.', 'error');
    return;
  }

  if (haySesion()) {
    window.location.href = new URL('cliente/checkout.html', raizSitio()).href;
    return;
  }

  abrirModalAcceso();
}

/* =========================================================
   Arranque
   ========================================================= */

/** Registra el panel lateral, el modal de acceso y sus eventos. */
export function iniciarPanelCarrito() {
  inyectarEstructura();
  pintarPanel();

  document.querySelectorAll('[data-abrir-carrito]').forEach((boton) => {
    boton.addEventListener('click', abrirPanel);
  });

  document.querySelector('[data-cerrar-carrito]')?.addEventListener('click', () => cerrarPanel());
  document.querySelector('[data-capa-carrito]')?.addEventListener('click', () => cerrarPanel());
  document.querySelector('[data-cerrar-acceso]')?.addEventListener('click', () => cerrarModalAcceso());
  document.querySelector('[data-capa-acceso]')?.addEventListener('click', () => cerrarModalAcceso());

  document.querySelector('[data-panel-lineas]')?.addEventListener('click', (evento) => {
    const sumar = evento.target.closest('[data-sumar]');
    const restar = evento.target.closest('[data-restar]');
    const quitar = evento.target.closest('[data-quitar]');

    if (sumar) {
      const id = sumar.dataset.sumar;
      const item = carrito.obtener().find((linea) => String(linea.id) === id);
      if (item && item.cantidad >= CANTIDAD_MAXIMA) {
        mostrarAviso(`La cantidad máxima por producto es ${CANTIDAD_MAXIMA}.`, 'info');
        return;
      }
      carrito.cambiar(id, (item?.cantidad || 0) + 1);
      mostrarAviso('Cantidad actualizada.', 'exito');
      return;
    }

    if (restar) {
      const id = restar.dataset.restar;
      const item = carrito.obtener().find((linea) => String(linea.id) === id);
      if (!item) return;
      if (item.cantidad <= 1) {
        carrito.eliminar(id);
        mostrarAviso('Elemento eliminado del carrito.', 'info');
      } else {
        carrito.cambiar(id, item.cantidad - 1);
        mostrarAviso('Cantidad actualizada.', 'exito');
      }
      return;
    }

    if (quitar) {
      carrito.eliminar(quitar.dataset.quitar);
      mostrarAviso('Elemento eliminado del carrito.', 'info');
    }
  });

  document.querySelector('[data-panel-vaciar]')?.addEventListener('click', () => {
    if (carrito.contar() === 0) {
      mostrarAviso('El carrito ya está vacío.', 'info');
      return;
    }
    carrito.vaciar();
    mostrarAviso('El carrito se vació.', 'info');
  });

  document.querySelector('[data-panel-continuar]')?.addEventListener('click', () => cerrarPanel());
  document.querySelector('[data-panel-finalizar]')?.addEventListener('click', finalizarCompra);

  /* Modal de acceso: iniciar sesión y seguir con el checkout. */
  const formulario = document.querySelector('[data-formulario-acceso]');
  if (formulario) {
    const region = formulario.querySelector('[data-mensaje-acceso]');

    construirValidador(formulario, {
      reglas: {
        'acceso-correo': (campo) => campo.value.trim().length > 3
      },
      alEnviar: async () => {
        const correo = formulario.querySelector('#acceso-correo').value;
        const contrasena = formulario.querySelector('#acceso-contrasena').value;
        const resultado = await iniciarSesion(correo, contrasena, 'cliente');

        if (!resultado.ok) {
          region.textContent = resultado.mensaje;
          region.dataset.tipo = 'error';
          region.hidden = false;
          return;
        }

        region.textContent = `${resultado.mensaje} Abriendo el checkout...`;
        region.dataset.tipo = 'exito';
        region.hidden = false;

        // El carrito no se toca: se conserva igual y sigue el checkout.
        window.location.href = new URL('cliente/checkout.html', raizSitio()).href;
      }
    });
  }

  /* Teclado: Escape cierra y el foco no sale del diálogo abierto. */
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      if (estaAbierto(document.querySelector('[data-modal-acceso]'))) {
        evento.preventDefault();
        cerrarModalAcceso();
      } else if (estaAbierto(document.querySelector('[data-panel-carrito]'))) {
        evento.preventDefault();
        cerrarPanel();
      }
      return;
    }

    if (evento.key !== 'Tab') return;

    const abierto = estaAbierto(document.querySelector('[data-modal-acceso]'))
      ? document.querySelector('[data-modal-acceso]')
      : estaAbierto(document.querySelector('[data-panel-carrito]'))
        ? document.querySelector('[data-panel-carrito]')
        : null;

    if (abierto) confinarFoco(abierto, evento);
  });

  /* Si el carrito cambia desde otra parte del sitio, el panel se repinta. */
  window.addEventListener('carrito:actualizado', pintarPanel);
}

/** Expuesto para las pruebas y para el enrutador de páginas. */
export const panelCarrito = {
  abrir: abrirPanel,
  cerrar: cerrarPanel,
  pintar: pintarPanel,
  abrirAcceso: abrirModalAcceso
};

export { finalizarCompra };
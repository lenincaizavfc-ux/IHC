/**
 * view.js - Vista: construye el HTML que se inserta en el documento.
 *
 * Solo se ocupa de presentar información: recibe datos del modelo y devuelve
 * elementos listos para insertarse. No guarda estado ni hace cálculos
 * de negocio (de eso se ocupan cart.js y repo.js).
 */

import { formatearPrecio, contarArticulos } from './cart.js';
import { raizSitio } from './storage.js';

/* =========================================================
   Utilidades de construcción de HTML
   ========================================================= */

/** Escapa los caracteres especiales del HTML para evitar inyección de contenido. */
export function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Convierte una ruta relativa del JSON en una URL absoluta.
 * Las imágenes del JSON están en /assets/, así que se resuelven desde la
 * raíz del sitio y no desde la carpeta de la página actual.
 */
export function rutaArchivo(ruta) {
  if (!ruta) return '';
  return new URL(ruta, raizSitio()).href;
}

/* =========================================================
   Tarjetas reutilizables
   ========================================================= */

/** Tarjeta de producto del ecommerce.
 *  El nombre va en <h3> porque cada producto cuelga del <h2> de su categoría
 *  (`seccionCategoriaTienda`), que a su vez cuelga del <h1> «Tienda»; con <h2> los productos quedaban como hermanos de
 *  su propia sección en lugar de subordinados a ella (WCAG 2.2 SC 1.3.1). */
export function tarjetaProducto(producto) {
  return `
    <article class="pf-tarjeta h-full flex flex-col overflow-hidden" data-producto="${escapar(
    producto.id
  )}">
      <img
        class="pf-imagen-tarjeta"
        src="${escapar(rutaArchivo(producto.imagen))}"
        alt="${escapar(producto.nombre)} de Planeta Fitness"
        loading="lazy"
        width="800"
        height="800">
      <div class="flex flex-col gap-3 p-5 flex-1">
        <p class="pf-etiqueta">${escapar(producto.categoria)}</p>
        <h3 class="text-lg font-bold text-white">${escapar(producto.nombre)}</h3>
        <p class="text-sm text-neutral-300 flex-1">${escapar(producto.descripcion)}</p>
        <p class="text-2xl font-extrabold text-pf-amarillo">${formatearPrecio(producto.precio)}</p>
        <button
          type="button"
          class="pf-boton pf-boton-primario w-full"
          data-accion="agregar"
          data-id="${escapar(producto.id)}"
          aria-label="Agregar ${escapar(producto.nombre)} al carrito, precio ${formatearPrecio(
    producto.precio
  )}">
          Agregar al carrito
        </button>
      </div>
    </article>`;
}

/** Convierte un texto en un identificador válido para anclas y atributos. */
function generarSlug(texto) {
  return (
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'categoria'
  );
}

/** Sección de tienda para una categoría: título propio y cuadrícula de productos. */
export function seccionCategoriaTienda({ categoria, productos }) {
  const slug = generarSlug(categoria);
  return `
    <section class="pf-tienda-categoria" aria-labelledby="categoria-${slug}">
      <h2 id="categoria-${slug}" class="pf-tienda-titulo">${escapar(categoria)}</h2>
      <div class="pf-tienda-grid">${productos.map(tarjetaProducto).join('')}</div>
    </section>`;
}

/** Tarjeta de plan del gimnasio. */
export function tarjetaPlan(plan) {
  const beneficios = plan.beneficios
    .map(
      (beneficio) => `
        <li class="flex items-start gap-2 text-sm text-neutral-300">
          <span aria-hidden="true" class="font-bold text-pf-amarillo">✓</span>
          <span>${escapar(beneficio)}</span>
        </li>`
    )
    .join('');

  return `
    <article class="pf-tarjeta h-full flex flex-col overflow-hidden" data-plan="${escapar(plan.id)}">
      <img
        class="pf-imagen-tarjeta"
        src="${escapar(rutaArchivo(plan.imagen))}"
        alt="${escapar(plan.nombre)} de Planeta Fitness"
        loading="lazy"
        width="600"
        height="450">
      <div class="flex flex-col gap-4 p-6 flex-1">
        <h2 class="text-xl font-bold text-white">${escapar(plan.nombre)}</h2>
        <p class="text-sm text-neutral-300">${escapar(plan.descripcion)}</p>
        <p class="text-3xl font-extrabold text-pf-amarillo">
          ${formatearPrecio(plan.precio)}
          <span class="text-sm font-semibold text-neutral-300">/ mes</span>
        </p>
        <h3 class="text-sm font-bold uppercase tracking-wide text-pf-amarillo">Incluye</h3>
        <ul class="space-y-1 flex-1">${beneficios}</ul>
        <button
          type="button"
          class="pf-boton pf-boton-primario w-full"
          data-accion="elegir-plan"
          data-plan-id="${escapar(plan.id)}"
          data-plan-nombre="${escapar(plan.nombre)}"
          data-plan-precio="${escapar(plan.precio)}"
          aria-label="Agregar ${escapar(plan.nombre)} al carrito, precio ${formatearPrecio(
    plan.precio
  )} al mes">
          Elegir plan
        </button>
      </div>
    </article>`;
}

/** Tarjeta de servicio del gimnasio.
 *  El nombre va en <h3>: cuelga del <h2> «Servicios» de `cliente/rutinas.html`
 *  (WCAG 2.2 SC 1.3.1). */
export function tarjetaServicio(servicio) {
  return `
    <article class="pf-tarjeta h-full flex flex-col overflow-hidden">
      <img
        class="pf-imagen-tarjeta"
        src="${escapar(rutaArchivo(servicio.imagen))}"
        alt="${escapar(servicio.nombre)} en Planeta Fitness"
        loading="lazy"
        width="600"
        height="450">
      <div class="flex flex-col gap-2 p-5 flex-1">
        <h3 class="text-lg font-bold text-white">${escapar(servicio.nombre)}</h3>
        <p class="text-sm text-neutral-300">${escapar(servicio.descripcion)}</p>
      </div>
    </article>`;
}

/** Tarjeta de una actividad con todos sus horarios, su lugar y su entrenador. */
export function tarjetaClase(clase, entrenador) {
  const horarios = clase.horarios
    .map(
      (horario) => `
        <li class="pf-clase-horario">
          <span class="pf-clase-dia">${escapar(horario.dia)}</span>
          <span class="pf-clase-hora">${escapar(horario.horaInicio)}${
        horario.horaFin ? ` – ${escapar(horario.horaFin)}` : ''
      }</span>
        </li>`
    )
    .join('');

  return `
    <article class="pf-clase" data-clase="${escapar(clase.id)}">
      <img
        class="pf-clase-imagen"
        src="${escapar(rutaArchivo(clase.imagen))}"
        alt="Clase de ${escapar(clase.nombre)} en Planeta Fitness"
        loading="lazy"
        width="600"
        height="400">
      <div class="pf-clase-cuerpo">
        <h2 class="pf-clase-nombre">${escapar(clase.nombre)}</h2>
        <p class="pf-clase-descripcion">${escapar(clase.descripcion)}</p>
        <ul class="pf-clase-horarios">${horarios}</ul>
        <dl class="pf-clase-meta">
          <div class="pf-clase-meta-fila">
            <dt>Lugar</dt>
            <dd>${escapar(clase.lugar)}</dd>
          </div>
          <div class="pf-clase-meta-fila">
            <dt>Entrenador</dt>
            <dd>${entrenador ? escapar(entrenador.nombre) : 'Por confirmar'}</dd>
          </div>
        </dl>
      </div>
    </article>`;
}

/** Tarjeta de entrenador.
 *  El nombre va en <h3>: cuelga del <h2> «Entrenadores» de `cliente/clases.html`, igual
 *  que los servicios cuelgan de su <h2> «Servicios» (WCAG 2.2 SC 1.3.1). */
export function tarjetaEntrenador(entrenador) {
  return `
    <article class="pf-tarjeta h-full flex flex-col overflow-hidden" data-entrenador="${escapar(
    entrenador.id
  )}">
      <img
        class="pf-imagen-tarjeta object-cover"
        src="${escapar(rutaArchivo(entrenador.imagen))}"
        alt="${escapar(entrenador.nombre)} de Planeta Fitness"
        loading="lazy"
        width="600"
        height="450">
      <div class="flex flex-col gap-2 p-5 flex-1">
        <h3 class="text-lg font-bold text-white">${escapar(entrenador.nombre)}</h3>
        <p class="pf-etiqueta self-start">${escapar(entrenador.especialidad)}</p>
        <p class="text-sm text-neutral-300">${escapar(entrenador.descripcion)}</p>
      </div>
    </article>`;
}

/* =========================================================
   Renderizado de listas
   ========================================================= */

/** Inserta una lista de tarjetas dentro de un contenedor. */
export function renderizar(contenedor, tarjetas) {
  if (!contenedor) return;
  contenedor.innerHTML = tarjetas.join('');
}

/** Mensaje estándar cuando un contenedor queda vacío. */
export function vacio(mensaje = 'No hay información disponible por ahora.') {
  return `<p class="pf-mensaje w-full">${escapar(mensaje)}</p>`;
}

/* =========================================================
   Elementos comunes de la interfaz
   ========================================================= */

/**
 * Actualiza el contador de productos del carrito en el encabezado.
 * El número se muestra siempre (también en cero) porque el botón del
 * carrito debe indicar cuántas personas hay dentro.
 * @param {number} articulos
 */
export function actualizarContadorCarrito(articulos = contarArticulos()) {
  document.querySelectorAll('[data-contador-carrito]').forEach((elemento) => {
    elemento.textContent = articulos;
    const contenedor = elemento.closest('a') || elemento.closest('button');
    if (contenedor) {
      contenedor.setAttribute(
        'aria-label',
        articulos === 0
          ? 'Carrito de compras, vacío'
          : `Carrito de compras con ${articulos} producto${articulos === 1 ? '' : 's'}`
      );
    }
  });
}

/** Muestra u oculta el bloque de sesión y escribe el nombre de quien inició sesión. */
export function actualizarEstadoSesion(usuario) {
  const bloques = document.querySelectorAll('[data-sesion]');

  bloques.forEach((bloque) => {
    const mostrar = bloque.dataset.sesion === (usuario ? 'activa' : 'inactiva');
    bloque.hidden = !mostrar;
  });

  document.querySelectorAll('[data-nombre-sesion]').forEach((elemento) => {
    // El encabezado usa solo el primer nombre ("Hola, Lenin") para no amontonarse.
    elemento.textContent = usuario ? String(usuario.nombre || '').trim().split(/\s+/)[0] : '';
  });
}

/** Escribe un mensaje en el aviso flotante accesible de la página. */
export function mostrarAviso(mensaje, tipo = 'info') {
  const aviso = document.querySelector('[data-aviso]');
  if (!aviso) return;

  aviso.textContent = mensaje;
  aviso.dataset.tipo = tipo;
  aviso.hidden = false;
  aviso.classList.add('pf-aparece');
  window.clearTimeout(aviso.dataset.timer);
  aviso.dataset.timer = window.setTimeout(() => {
    aviso.hidden = true;
    aviso.classList.remove('pf-aparece');
  }, 4000);
}
# Planeta Fitness — Ecommerce web

Proyecto académico de la asignatura **Desarrollo en Plataformas** (RDA 1). Consiste en un sitio web tipo ecommerce para **Planeta Fitness**, un gimnasio ubicado en Quito, Ecuador.

## Descripción y objetivo del proyecto

Planeta Fitness es un gimnasio con dos pisos, clases de boxeo y bailoterapia, rutinas personalizadas según nivel y una sección de nutrición con cita previa.

El objetivo del proyecto es aplicar los conocimientos trabajados en clase (HTML5 semántico, CSS3, JavaScript ES6+, formularios, validaciones, expresiones regulares, DOM, eventos, Fetch API, JSON, Web Storage, cookies, IndexedDB, accesibilidad y patrón MVC) para desarrollar un ecommerce completamente funcional en frontend.

El sitio tiene dos áreas separadas:

- **Área pública / cliente:** un **sitio multipágina**: cada sección del menú es su propio archivo HTML (sin One-Page ni navegación por anclas). `index.html` es la portada (hero y tarjetas de acceso) y el resto vive en `cliente/`: `planes.html`, `tienda.html`, `clases.html`, `rutinas.html`, `nutricion.html`, `contacto.html`, `login.html` y `checkout.html`. El carrito es un **panel lateral** disponible en todo el sitio.
- **Área administrativa:** dashboard para gestionar productos, planes, clases, entrenadores y las citas de nutrición, con sus propias páginas en `admin/`.

No hay backend ni base de datos remota: toda la información del catálogo vive en archivos JSON locales y en el almacenamiento del navegador.

Los datos reales del gimnasio se respetan tal como fueron proporcionados: tres planes ($35, $60 y $85), boxeo lunes/jueves/viernes de 07:00 a 09:00, bailoterapia martes y jueves de 18:30 a 20:30, atención de lunes a viernes de 06:00 a 21:00, sábado de 09:00 a 12:00 y domingo cerrado. La asesoría nutricional **no tiene precio publicado**: el sitio indica que requiere cita y que el precio se consulta en el gimnasio.

---

## Tecnologías

### Tecnologías utilizadas

- **HTML5 semántico** (`header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `figure`).
- **Formularios HTML5**, validación nativa HTML5, **expresiones regulares** y validación personalizada con JavaScript.
- **CSS3** con enfoque **mobile-first**, **Flexbox**, **Grid** y **media queries** para diseño **responsive**.
- **JavaScript ES6+**: módulos nativos (`import`/`export`), funciones, clases, funciones flecha, promesas, `async/await`, manipulación del **DOM**, **eventos** y control de flujo.
- **JSON** local como fuente de datos.
- **Fetch API** para cargar datos desde archivos JSON.
- **Web Storage** (`localStorage` y `sessionStorage`), **cookies** e **IndexedDB** para persistencia de datos en el navegador.
- **Accesibilidad web (WCAG)**: uso de **ARIA** (`aria-live`, `aria-busy`, `aria-invalid`, `aria-describedby`, `aria-label`, `aria-current`, `aria-modal`), navegación por teclado, gestión del foco, contraste adecuado y textos alternativos.
- **jQuery**: utilizado únicamente para manipulación del DOM y gestión de eventos, según el alcance del proyecto.
- **Patrón MVC** (Modelo–Vista–Controlador) aplicado con modularidad en frontend mediante módulos ES.

---

## Estructura de carpetas

```text
PROYECTO_RDA_1/
│
├── index.html
├── README.md
│
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── icons/
│   │   └── favicon.svg
│   ├── js/
│   │   └── identidad.js
│   └── img/
│       ├── logo/
│       ├── productos/
│       ├── gimnasio/
│       ├── clases/
│       └── entrenadores/
│
├── data/
│   ├── productos.json
│   ├── planes.json
│   ├── clases.json
│   ├── entrenadores.json
│   └── gimnasio.json
│
├── js/
│   ├── app.js
│   ├── repo.js
│   ├── view.js
│   ├── cart.js
│   ├── carrito-panel.js
│   ├── auth.js
│   ├── validation.js
│   ├── storage.js
│   ├── indexeddb.js
│   └── admin.js
│
├── cliente/
│   ├── planes.html
│   ├── tienda.html
│   ├── clases.html
│   ├── rutinas.html
│   ├── nutricion.html
│   ├── contacto.html
│   ├── login.html
│   └── checkout.html
│
├── admin/
│   ├── login.html
│   ├── index.html
│   ├── productos.html
│   ├── planes.html
│   ├── clases.html
│   └── entrenadores.html
│
└── pruebas/
    ├── servidor.mjs
    ├── prueba-logica.mjs
    ├── prueba-repo.mjs
    ├── prueba-selectores.mjs
    ├── prueba-navegador.mjs
    ├── prueba-paginas.mjs
    ├── prueba-accesibilidad.mjs
    ├── prueba-arquitectura.mjs
    ├── prueba-enlaces.mjs
    ├── prueba-html.mjs
    └── prueba-responsive.mjs
```

### Explicación técnica

#### Patrón MVC y modularidad en frontend

El proyecto aplica el **patrón Modelo–Vista–Controlador (MVC)** utilizando **módulos JavaScript ES6+** (`import`/`export`). La separación de responsabilidades se mantiene dentro de los archivos existentes, sin modificar la estructura de carpetas:

| Capa | Archivos | Responsabilidades |
|---|---|---|
| **Modelo** | `js/repo.js`, `js/indexeddb.js`, `js/storage.js`, `js/cart.js`, `js/auth.js` | Gestión de datos, carga desde JSON con **Fetch API**, persistencia (`localStorage`, `sessionStorage`, **cookies**, **IndexedDB**), estado del carrito, cálculo de totales, gestión de sesión y usuarios. |
| **Vista** | `js/view.js`, `js/carrito-panel.js`, `assets/js/identidad.js` | Generación y actualización de la interfaz HTML, presentación de tarjetas, renderizado del panel lateral, gestión del foco y elementos visuales. No modifican datos ni reglas de negocio. |
| **Controlador** | `js/app.js`, `js/admin.js` | Escucha **eventos** del DOM, coordina Modelo y Vista, aplica **validaciones** (HTML5 + JavaScript + expresiones regulares) y controla el flujo de la aplicación. |

Los módulos permiten la **modularidad en frontend**, reutilizando funciones y manteniendo cada archivo con responsabilidades bien definidas.

#### JavaScript, DOM y eventos

- Se utiliza **JavaScript ES6+** (funciones, funciones flecha, clases, promesas, `async/await`).
- Manipulación del **DOM** para renderizar contenido dinámico y actualizar la interfaz.
- Gestión de **eventos** (clic, teclado, submit, input, `IntersectionObserver`) para controlar la navegación activa, el menú móvil, el panel lateral, el carrito y los formularios.

#### Carga de datos

- Los archivos `data/*.json` se cargan mediante **Fetch API** (`async/await`).
- Se aplica una **experiencia progresiva**: si Fetch falla, se lee la copia almacenada en **IndexedDB** para mostrar el catálogo disponible.

---

## Funcionamiento del catálogo y carrito

### Área pública / Cliente

- **Sitio multipágina:** cada página tiene su propio `<title>`, meta description, un solo `<h1>` y su `data-pagina` en el `<body>`, que `js/app.js` usa para elegir el controlador:

  | Página | Archivo | `data-pagina` | Contenido |
  | --- | --- | --- | --- |
  | Inicio | `index.html` | `inicio` | Hero y tarjetas que llevan a cada página |
  | Planes | `cliente/planes.html` | `planes` | Planes desde `planes.json` y «Cómo elegir tu plan» |
  | Tienda | `cliente/tienda.html` | `tienda` | Productos por categoría desde `productos.json` |
  | Clases | `cliente/clases.html` | `clases` | Clases y entrenadores desde `clases.json` y `entrenadores.json` |
  | Rutinas | `cliente/rutinas.html` | `rutinas` | Niveles y servicios desde `gimnasio.json` |
  | Nutrición | `cliente/nutricion.html` | `nutricion` | Servicios de la nutricionista y solicitud de cita |
  | Contacto | `cliente/contacto.html` | `contacto` | Dirección, horarios y formulario de contacto |
  | Inscríbete | `cliente/login.html` | `login` | Inicio de sesión y registro |
  | Finalizar compra | `cliente/checkout.html` | `checkout` | Resumen y confirmación del pedido |

  El menú principal es el mismo en todas las páginas (Inicio, Planes, Tienda, Clases, Rutinas, Nutrición, Contacto, Inscríbete/sesión, carrito y botón de menú) y enlaza a los archivos reales con rutas relativas. La página actual lleva `pf-enlace-activo` y `aria-current="page"`. Ningún enlace del menú ni del pie usa anclas; cada página conserva el enlace de accesibilidad «Ir al contenido principal» (`#contenido`).
- **Catálogo de productos:** se cargan desde `data/productos.json` mediante **Fetch API**, con un total de **10 productos** organizados por **categorías** (Suplementos, Ropa y Accesorios). Se renderizan dinámicamente con `js/view.js`. No hay buscador ni filtros.
- **Planes:** se cargan desde `data/planes.json`. El botón «Elegir plan» agrega el plan al carrito (tipo `plan`), sin exigir sesión, y abre el panel lateral.
- **Clases:** se cargan desde `data/clases.json` y `data/entrenadores.json`, mostrando horarios agrupados por actividad, lugar y entrenador.
- **Carrito (panel lateral):** disponible en todo el sitio. Permite **añadir**, **aumentar/disminuir cantidad**, **eliminar línea**, **vaciar carrito**, ver subtotal y total. El estado del carrito se gestiona en `js/cart.js` y se guarda en **localStorage**, por lo que persiste al recargar o cambiar de página.
- **Finalizar compra:** exige sesión. Si no hay sesión, se abre un **modal de acceso** dentro de la misma página y **el carrito no se vacía** mientras se autentica. Con sesión, se redirige a `cliente/checkout.html`.
- **Checkout:** muestra los datos del cliente (autocompletados desde la sesión), el resumen del pedido, validación de los datos y, al confirmar, genera un código de pedido. El pedido se guarda en **localStorage** e **IndexedDB** (almacén `pedidos`), y solo entonces se vacía el carrito. Si el pedido incluye un plan, se registra como suscripción del cliente. Sin sesión, el acceso al checkout redirige a `cliente/login.html`.
- **Nutrición:** formulario de cita de asesoría nutricional (sin precio publicado). Las citas se almacenan localmente.
- **Login y registro:** autenticación local de clientes usando `data/gimnasio.json` como referencia, con registro opcional guardado en el navegador.

### Área administrativa

- Acceso desde `admin/login.html`. Solo usuarios con rol `admin` pueden acceder al dashboard.
- **Dashboard** (`admin/index.html`): muestra totales y las citas de nutrición registradas.
- **Productos** (`admin/productos.html`): agregar, editar, eliminar y restablecer catálogo.
- **Planes** (`admin/planes.html`): editar nombre, precio y descripción.
- **Clases** (`admin/clases.html`): modificar día, hora de inicio, hora de fin y entrenador.
- **Entrenadores** (`admin/entrenadores.html`): actualizar especialidad y descripción.

Los cambios realizados desde el área administrativa se aplican sobre el catálogo mediante `js/repo.js`, quedando reflejados en la vista pública.

### Administrador

1. Entra en `admin/login.html` con la cuenta de administrador.
2. El dashboard muestra totales del catálogo, accesos rápidos y las citas de nutrición registradas.
3. En **Productos** puede agregar, editar y eliminar productos, además de restablecer el catálogo.
4. En **Planes** edita nombre, precio y descripción de los planes existentes.
5. En **Clases** cambia día, hora de inicio, hora de fin y entrenador de cada horario.
6. En **Entrenadores** actualiza especialidad y descripción de los 3 entrenadores.

Cada página del dashboard verifica la sesión: sin rol `admin` en `sessionStorage` redirige al login
administrativo.

### Catálogo y flujo de compra

```text
productos.json → Fetch → repo.js → productos[] → view.js → tarjetas → agregar
    ↓                                                                    ↓
IndexedDB                                            localStorage ← cart.js
                                                                         ↓
                                            panel lateral (carrito-panel.js)
                                                                         ↓
                                              finalizar compra → ¿hay sesión?
                                                        │                │
                                                  No ─┘                └─ Sí
                                          modal de acceso          cliente/checkout.html
                                             (carrito intacto)      → confirmar pedido
                                                                        → localStorage + IndexedDB
```

La compra **no** incluye pago en línea ni servidor: el sitio registra el pedido y la persona lo
retira en el gimnasio (Avenida San Rio de Janeiro y Panamá, Quito).

### Login

```text
Inicio → Iniciar sesión → ¿Tipo de usuario?
                            ├── Cliente      → páginas del cliente
                            └── Administrador→ admin/login.html
```

- Cliente: `cliente@planetafitness.ec` / `cliente123`
- Administrador: `admin@planetafitness.ec` / `admin123`

El login es académico: no es autenticación real de producción.

---

## Persistencia (Web Storage, cookies e IndexedDB)

Se utiliza persistencia en el navegador sin backend remoto:

| Mecanismo | Uso |
|---|---|
| **localStorage** | Carrito de compras, cambios realizados desde el área administrativa, citas de nutrición, **pedidos confirmados**, registros de clientes y mensajes de contacto. |
| **sessionStorage** | Sesión del usuario (nombre, correo, rol, nivel) y paso pendiente del checkout. |
| **IndexedDB** | Copia local del catálogo (`productos`, `planes`, `clases`, `entrenadores`) y registros (`citas`, `pedidos`). Base de datos: **`PlanetaFitnessDB`** (versión 2), con almacén `pedidos`. |
| **Cookies** | Preferencia del aviso de cookies y marca de la última actualización del catálogo. |

**Experiencia progresiva:** al cargar, se intenta obtener los JSON con **Fetch API**. Si la respuesta es correcta, se guarda el catálogo en **IndexedDB**. Si Fetch falla (servidor no disponible), se lee la copia guardada en **IndexedDB** para mostrar el catálogo, informando el origen con `aria-live`.

### Experiencia progresiva

```text
Fetch a data/productos.json
   ↓ ¿funciona?
  Sí                      No
  ↓                       ↓
Guardar en IndexedDB   Leer IndexedDB
  ↓                       ↓
Mostrar catálogo       Mostrar catálogo guardado
```

Si el archivo JSON no está disponible, el sitio muestra la copia guardada en IndexedDB e informa el
cambio de origen en la región `aria-live`.

### Última actualización

Tras cada carga correcta del catálogo se registra la fecha con el objeto `Date`:

```javascript
const fecha = new Date();
const marca = fecha.toISOString(); // se guarda en la cookie ultimaActualizacion
```

El pie de página muestra «Catálogo actualizado: …» con la fecha en formato legible.

---

## Validaciones

### Formularios, validaciones y expresiones regulares

Se aplican **validaciones en dos capas** para garantizar la correcta entrada de datos:

1. **Validación HTML5 nativa:** atributos `required`, `type`, `minlength`, `maxlength`, `pattern`, `inputmode` y uso de `checkValidity()`.
2. **Validación con JavaScript + Expresiones Regulares:** implementada en `js/validation.js`, utilizando `setCustomValidity()` y reglas específicas para cada formulario.

Reglas aplicadas (con expresiones regulares):

- **Nombre y apellidos:** validación de formato de texto (`validarNombre`).
- **Cédula de identidad (Ecuador):** validación de 10 dígitos (`validarCedula`).
- **Teléfono/celular:** debe iniciar con `09` y tener 10 dígitos (`validarTelefono`).
- **Correo electrónico:** validación HTML5 y verificación de formato.
- **Contraseña:** debe contener letras y números (`validarContrasena`).
- **Confirmación de contraseña:** comparación obligatoria (`validarCoincidencia`).
- **Fechas:** no se permiten fechas pasadas en citas de nutrición (`validarFechaFutura`).
- **Campos obligatorios y mensajes de ayuda:** cada campo cuenta con su `<label>`, mensaje de ayuda vinculado con `aria-describedby` y mensajes de error con `role="alert"`.

La validación se ejecuta tanto en `blur/input` como al enviar el formulario. Tras corregir un error, el mensaje se actualiza correctamente.

## Accesibilidad web (WCAG), ARIA y navegación por teclado

Se aplican principios de **accesibilidad web (WCAG)**:

- **HTML semántico:** un solo `<main>` por página, un solo `<h1>`, jerarquía ordenada de encabezados y `<article>` para cada producto, plan, clase o entrenador.
- **ARIA:** uso de `aria-live="polite"` para mensajes dinámicos, `aria-busy` en contenedores que cargan datos, `aria-invalid` y `aria-describedby` en campos con error, `aria-current="page"` en el enlace de la página actual y `aria-modal="true"` en panel lateral y modal de acceso.
- **Navegación por teclado:** completamente operable con `Tab`, `Shift+Tab`, `Enter` y `Espacio`.
- **Gestión del foco:** el panel lateral y el modal de acceso confinan el foco dentro del diálogo, se cierran con `Escape` o con la capa oscura y devuelven el foco al botón que los abrió.
- **Foco visible:** `:focus-visible` con contorno de 3 px y `outline-offset`.
- **Contraste:** colores que cumplen con una relación mínima superior a 4.5:1 para texto normal.
- **Textos alternativos:** todas las imágenes informativas tienen `alt` descriptivo; las decorativas usan `alt=""`.
- **Mensajes de error sin depender del color:** incluyen el símbolo de advertencia `⚠` y explican qué está mal y cómo corregirlo.
- **Zoom:** sin desbordamiento horizontal al aumentar el zoom.
- **Movimiento reducido:** `@media (prefers-reduced-motion: reduce)` desactiva animaciones.

---

## Responsive

Diseño **mobile-first** con unidades relativas (`rem`, `%`, `vw`):

- **Móvil (por defecto):** una columna, menú plegado, tarjetas apiladas y botones grandes.
- **Tablet (`min-width: 768px`):** dos columnas en planes y catálogo.
- **Escritorio (`min-width: 1024px`):** tres columnas, navegación en línea, menú centrado y pie en
  cuatro columnas. Entre 1024 y 1279 px el carrito se muestra solo con el icono para que la
  navegación no se comprima.
- **Escritorio amplio (`min-width: 1280px`):** el encabezado gana altura, el logo crece y vuelve el
  texto del botón del carrito.
- El catálogo de productos usa **Grid**; las cabeceras, botones y el carrito usan **Flexbox**.
- El panel lateral ocupa `min(26rem, 100%)` y pasa a ancho completo por debajo de 480 px.
- Las imágenes son flexibles (`max-width: 100%; height: auto`); las clases y el catálogo usan
  cuadrícula de una columna en móvil y dos (clases) o tres (tienda) en escritorio, sin desplazar
  la página en horizontal.

---

## Imágenes

Las 14 fotografías del catálogo se descargaron de [Unsplash](https://unsplash.com) y se guardan
**localmente** en `assets/img/` (no hay hotlinking). Se usan bajo la
[licencia de Unsplash](https://unsplash.com/license). Identificador de origen de cada una:

| Archivo | Foto original |
|---|---|
| `gimnasio/hero-gimnasio.jpg` | `https://images.unsplash.com/photo-1534438327276-14e5300c3a48` |
| `gimnasio/pesas.jpg` | `https://images.unsplash.com/photo-1583454110551-21f2fa2afe61` |
| `gimnasio/cardio.jpg` | `https://images.unsplash.com/photo-1571902943202-507ec2618e8f` |
| `gimnasio/nutricion.jpg` | `https://images.unsplash.com/photo-1490645935967-10de6ba17061` |
| `clases/boxeo.jpg` | `https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e` |
| `clases/bailoterapia.jpg` | `https://images.unsplash.com/photo-1544367567-0f2fcb009e0b` |
| `productos/proteina.jpg` | `https://images.unsplash.com/photo-1505576399279-565b52d4ac71` |
| `productos/creatina.jpg` | `https://images.unsplash.com/photo-1593095948071-474c5cc2989d` |
| `productos/barras-energeticas.jpg` | `https://images.unsplash.com/photo-1606312619070-d48b4c652a52` |
| `productos/camisetas-deportivas.jpg` | `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab` |
| `productos/shorts-deportivas.jpg` | `https://images.unsplash.com/photo-1591195853828-11db59a44f6b` |
| `entrenadores/entrenador-1.jpg` | `https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b` |
| `entrenadores/entrenador-2.jpg` | `https://images.unsplash.com/photo-1518611012118-696072aa579a` |
| `entrenadores/entrenador-3.jpg` | `https://images.unsplash.com/photo-1534258936925-c58bed479fcb` |

Los logotipos (`assets/img/logo/`), el favicon y `assets/img/productos/generico.svg` son recursos
propios del proyecto.

---

## Instrucciones de uso

El proyecto utiliza **módulos JavaScript ES6+** (`type="module"`), por lo que **no funciona** abriendo los archivos directamente con `file://`. Es necesario servirlo mediante un servidor HTTP.

### Opción 1: Live Server (VS Code)

1. Abrir la carpeta del proyecto en Visual Studio Code.
2. Instalar la extensión **Live Server**.
3. Clic derecho en `index.html` → **Open with Live Server**.

### Opción 2: Desde la terminal

```bash
# Con Python 3
python -m http.server 5500

# Con Node.js
npx serve .
```

Abrir `http://localhost:5500` (o el puerto indicado por el servidor).

### Cuentas de prueba (para fines académicos)

- **Cliente:** `cliente@planetafitness.ec` / `cliente123`
- **Administrador:** `admin@planetafitness.ec` / `admin123`

Estas credenciales se encuentran en `data/gimnasio.json` y se utilizan únicamente para demostración académica. No constituyen autenticación real de producción.

---

## Publicación en Neocities

1. Crear una cuenta en <https://neocities.org>.
2. Crear un sitio nuevo (por ejemplo `planeta-fitness`).
3. Subir el contenido respetando las carpetas: `index.html` en la raíz, y las carpetas `assets`,
   `data`, `js`, `cliente` y `admin` completas.
4. Verificar que `data/` se haya subido: el catálogo se carga con Fetch y necesita esa carpeta.
5. Comprobar la web en la URL pública del sitio.

---

## Pruebas y CI/CD

### Pruebas realizadas

Las pruebas son archivos de Node.js sin dependencias del sitio web. Se ejecutan desde la raíz del proyecto:

```bash
node pruebas/prueba-logica.mjs        # Carrito y validaciones
node pruebas/prueba-repo.mjs          # Fetch, merging y respaldo en IndexedDB
node pruebas/prueba-selectores.mjs    # Selectores, menú multipágina e imágenes existentes
node pruebas/prueba-accesibilidad.mjs # Accesibilidad
node pruebas/prueba-arquitectura.mjs  # Arquitectura
node pruebas/prueba-enlaces.mjs      # Enlaces
node pruebas/prueba-html.mjs          # HTML
node pruebas/prueba-responsive.mjs   # Responsive
node pruebas/prueba-navegador.mjs     # Flujo real con Playwright
node pruebas/prueba-paginas.mjs       # Cada página carga y marca su enlace activo
```

`prueba-navegador.mjs` levanta su propio servidor estático (`pruebas/servidor.mjs`) y utiliza **Playwright** (dependencia exclusiva de las pruebas, no del sitio). Para ejecutarla:

```bash
npm install playwright && npx playwright install chromium
node pruebas/prueba-navegador.mjs
```

Si se desea usar una instalación externa, se puede apuntar con la variable `PW_MODULO`:

```bash
set PW_MODULO=C:\ruta\node_modules\playwright\index.js
node pruebas/prueba-navegador.mjs
```

### Integración continua (CI/CD)

El repositorio incluye un archivo de workflow en `.github/workflows/` con el objetivo de automatizar la verificación básica del proyecto. Esto se realiza únicamente con herramientas disponibles en el entorno académico, sin añadir dependencias innecesarias al proyecto.

### Cobertura funcional

- [x] Sitio multipágina: 3 planes, 10 productos, 2 clases, 3 entrenadores, 5 sesiones de
      horario, 6 servicios, 3 niveles y 3 horarios de atención.
- [x] Catálogo de 10 productos agrupado en secciones por categoría (Suplementos, Ropa, Accesorios),
      generado desde el JSON, sin buscador ni filtros.
- [x] Carrito lateral: agregar desde la tienda y desde los planes, cambiar cantidad, eliminar,
      vaciar y recargar la página.
- [x] Panel lateral del carrito en todas las páginas del cliente: se abre, se cierra con Escape,
      con la capa oscura y con «Continuar comprando»; el foco queda confinado dentro del diálogo.
- [x] Agregar al carrito **no exige sesión** y el carrito sobrevive al cambio de página.
- [x] «Finalizar compra» sin sesión abre el modal de acceso sin vaciar el carrito.
- [x] Checkout: resumen, autocompletado desde la sesión, validación del teléfono, confirmación con
      código de pedido, punto de retiro y carrito vaciado. Sin sesión devuelve al login.
- [x] El pedido confirmado queda en `localStorage` y en el almacén `pedidos` de IndexedDB.
- [x] Validaciones de contacto, login, registro y cita de nutrición (HTML5 + JavaScript),
      incluida la recuperación del campo después de corregirlo.
- [x] Login de cliente y de administrador, con redirección según el rol.
- [x] Flujo de plan: «Elegir plan» lo agrega al carrito, pide login al finalizar y registra la
      suscripción al confirmar el pedido.
- [x] Registro local de un cliente nuevo y posterior inicio de sesión con esa cuenta.
- [x] Alta, edición y baja de productos desde el dashboard, con imagen genérica para los nuevos.
- [x] El cambio hecho en el dashboard se refleja en el catálogo público.
- [x] Cita de nutrición visible en el dashboard.
- [x] Aviso de cookies y marca de última actualización.
- [x] Copia del catálogo efectivo guardada en IndexedDB.
- [x] Encabezado fijo (`sticky`) con sombra al bajar y **navegación activa** que marca la página
      actual (`.pf-enlace-activo` + `aria-current="page"`).
- [x] Menú responsive: en línea en escritorio y como **panel flotante** en móvil (sin empujar el
      contenido), que se cierra con Escape, al elegir una página, con el botón o al hacer clic fuera.
- [x] Encabezado de altura cómoda que crece en escritorio (logo, enlaces y botones con más aire)
      sin volver al encabezado gigante ni romper la navegación.
- [x] Clases como tarjetas por actividad: foto, descripción, horarios agrupados con día y hora,
      lugar y entrenador, en una columna en móvil y dos en escritorio.
- [x] Navegación multipágina: cada enlace del menú y del pie va a su archivo `.html`
      (`index.html` y `cliente/planes.html`, `tienda.html`, `clases.html`, `rutinas.html`,
      `nutricion.html`, `contacto.html`), sin anclas entre secciones.
- [x] Sin desbordamiento horizontal en 320, 375, 390, 430, 768, 1024 y 1440 px.
- [x] Enlace de salto al contenido, textos alternativos y un solo `h1` por página.
- [x] Sin errores de JavaScript en la consola durante todo el recorrido.

### Revisión manual

- [x] Recorrido completo con teclado desde el inicio hasta el carrito.
- [x] Contraste, foco visible y mensajes con `aria-live`.
- [x] Revisión responsive con zoom aumentado.

---

## Publicación en GitHub Pages

Para publicar el proyecto en **GitHub Pages**:

1. Crear un repositorio en [GitHub](https://github.com/) con el nombre del proyecto.
2. Subir todos los archivos respetando la estructura de carpetas completa (`index.html` en la raíz, junto a `assets/`, `data/`, `js/`, `cliente/`, `admin/` y `pruebas/`).
3. En el repositorio, ir a **Settings > Pages**.
4. En **Branch**, seleccionar la rama principal (`main` o `master`) y la carpeta `/ (root)`.
5. Guardar los cambios. GitHub Pages generará la URL pública del sitio (por ejemplo: `https://usuario.github.io/nombre-repositorio/`).
6. Verificar que la carga de archivos JSON funciona correctamente mediante **Fetch API** (servido por HTTP).

**Importante:** al tratarse de un sitio con módulos ES (`type="module"`), debe servirse por HTTPS/HTTP en GitHub Pages (no con `file://`).

## Entrega

- Proyecto completo con su estructura original.
- `README.md` actualizado y alineado con los contenidos de las semanas 1 a 6.
- Verificación local mediante servidor HTTP.
- Preparado para su publicación en **GitHub Pages**.
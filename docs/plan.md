# Plan de Implementacion por Vertical Slices: Baby Tracker Core (MVP)

> Especificacion base: [docs/spec.md](./spec.md). Reglas SDD del repo: [AGENTS.md](../AGENTS.md).
> No se modificara ni creara codigo fuera del alcance de este plan hasta aprobar/ejecutar los slices.

## Cobertura de Requisitos de `docs/spec.md`
- **Sec. 1 (Objetivo y Contexto)**: PWA movil personal para 2 cuidadores en Android gama de entrada (ej. Samsung Galaxy A07), sin anuncios, online/offline, uso con una mano, Modo Noche suave.
- **Sec. 2 (Stack y Arquitectura Base)**: Vite + React + TypeScript, estilos con variables CSS (tema claro y modo noche activable/desactivable), Vitest para pruebas unitarias de logica; PWA instalable; Offline-First con IndexedDB local primero, timestamps ISO UTC, `babyId` y `createdBy` locales por defecto hasta vincular Supabase (reasignando ambos al `babyId` y `user.id` reales antes de sincronizar), cola de sincronizacion, `syncStatus` exclusivo del cliente y LWW por `updatedAt` con `UUID` generado en cliente; borrado logico con `deletedAt` + `updatedAt`. Prerrequisitos: Slices 1-6 solo Node.js/npm local; Slice 7 proyecto Supabase, `babyId` preconfigurado y `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- **Sec. 3 (Modulos del MVP)**:
  - **3.1 Alimentacion**: lactancia (`startedAt`/`endedAt` de evento + intervalos `{ start, end: string | null }` por lado `left`/`right` + ultimo lado segun el intervalo mas reciente de la sesion), mamadera (`ml`, tipo, hora), extraccion (duracion y/o `ml`, lado opcional).
  - **3.2 Sueno**: siestas y nocturno (`kind: 'nap' | 'night'`), cronometro activo + carga/edicion manual, ventana de vigilia y duracion del ultimo sueno.
  - **3.3 Panales**: registro en 1-2 toques (`pis`, `caca`, `ambos`), hora ajustable (default ahora) y nota breve opcional.
  - **3.4 Salud, Crecimiento y Notas**: temperatura (°C), peso/talla con fecha, medicacion (`medName` y `dose`) y notas rapidas para pediatra.
  - **3.5 Estado Actual, Historial y Modo Noche**: resumen "hace cuanto" (ultima toma, ultimo panal, tiempo despierto), linea de tiempo diaria editable/eliminable agrupada por fecha calendario en hora local del dispositivo (segun `startedAt` local) e interruptor de Modo Noche.
- **Sec. 4 (Fuera de Alcance v2+)**: excluye predicciones algoritmicas de sueno, graficos clinicos avanzados e integraciones externas.
- **Sec. 5 (Criterios de Aceptacion CA-1 a CA-5)** y **Sec. 6 (`BabyEvent`)**: contrato unico de eventos con `deletedAt: string | null`, timestamps ISO UTC, `syncStatus` solo local y validacion de extremo a extremo.

---

## Principios de Ejecucion (Vertical Slices)
1. **Primero valor local utilizable**: los primeros slices (1-6, que solo requieren Node.js/npm local) entregan una app funcional 100% offline en el dispositivo antes de conectar Supabase en Slice 7.
2. **Cada slice toca punta a punta**: modelo/dominio + persistencia local + UI movil para una mano + pruebas Vitest de la logica + verificacion concreta.
3. **Contrato unico desde el inicio**: todo evento se modela con `BabyEvent` (`id`, `babyId`, `type`, `startedAt`, `endedAt`, `payload`, `createdBy`, `createdAt`, `updatedAt`, `deletedAt`, `syncStatus` local) guardando timestamps en ISO UTC y usando `babyId` y `createdBy` locales por defecto hasta vincular Supabase.

---

## Mapa de Vertical Slices

### Slice 1: Esqueleto PWA Movil + Sistema de Tema con Variables CSS y Modo Noche
- **Requisitos cubiertos**: Sec. 1, Sec. 2 (Vite + React + TypeScript, variables CSS, Vitest, prerrequisito Node.js/npm), Sec. 3.5 (Modo Noche), CA-5.
- **Alcance tecnico**:
  - Inicializar Vite + React + TypeScript (`strict`) con Vitest configurado y estructura modular (`domain/`, `storage/`, `sync/`, `ui/`).
  - Configurar `manifest.webmanifest` y Service Worker basico para instalacion en Android y cache de shell/assets.
  - Implementar layout base optimizado para uso con una mano (controles principales en zona inferior/accesible) y sistema de temas con variables CSS (Claro / Modo Noche: fondo muy oscuro, alto contraste suave sin blancos brillantes ni destellos).
  - Interruptor visible de Modo Noche en cabecera, persistido en `localStorage` y pre-aplicado antes de montar React para evitar destellos al abrir la app.

### Slice 2: Base Local (`BabyEvent` + IndexedDB) y Registro Rapido de Panales con Contador "Hace Cuanto"
- **Requisitos cubiertos**: Sec. 2 (IndexedDB local primero, timestamps ISO UTC, `babyId`/`createdBy` locales por defecto, `UUID` cliente, `syncStatus` solo local, Vitest), Sec. 3.3 (Panales), Sec. 3.5 (resumen "hace cuanto" + linea de tiempo diaria agrupada por fecha local de `startedAt`), Sec. 6 (`BabyEvent` + `deletedAt: null` + `type: 'diaper'`), CA-2 (parte local offline).
- **Alcance tecnico**:
  - Definir tipos TypeScript de `BabyEvent` (incluyendo `deletedAt: string | null`), constantes por defecto para `babyId` y `createdBy` locales, generador de `UUID` en cliente y utilidades puras en Vitest para timestamps ISO UTC, agrupacion por fecha calendario en hora local del dispositivo (a partir de `startedAt`) y formato de tiempo relativo.
  - Capa minima de IndexedDB (`events` store) con lectura/escritura inmediata sin red y marcado `syncStatus: 'pending'` (exclusivo del cliente).
  - Flujo de registro de panal en 1-2 toques (`pis`, `caca`, `ambos`), hora ajustable (por defecto ahora) y nota breve opcional.
  - Tarjeta de Estado Actual mostrando en vivo "hace cuanto" fue el ultimo panal (y tipo) + listado cronologico del dia agrupado en hora local del dispositivo y excluyendo registros con `deletedAt !== null`.

### Slice 3: Edicion, Borrado (`deletedAt`) y Recalculo de Estado en Linea de Tiempo Local
- **Requisitos cubiertos**: Sec. 2 (`updatedAt`, `deletedAt`, LWW, Vitest), Sec. 3.5 (linea de tiempo diaria editable/eliminable), Sec. 6 (`deletedAt`), CA-3 (recalculo sin datos huerfanos).
- **Alcance tecnico**:
  - Habilitar edicion de eventos en la linea de tiempo diaria (actualizando `updatedAt` en ISO UTC y `syncStatus: 'pending'`).
  - Habilitar borrado logico seteando `deletedAt` y `updatedAt` con el timestamp ISO UTC actual (y `syncStatus: 'pending'`), excluyendo todo evento con `deletedAt !== null` de vistas y contadores activos.
  - Recalculo inmediato y puro de todos los contadores de Estado Actual ("hace cuanto") ante altas, ediciones o borrados, validado con Vitest.

### Slice 4: Modulo de Sueno (Cronometro Persistente, Carga Manual y Ventana de Vigilia)
- **Requisitos cubiertos**: Sec. 3.2 (Sueno con `kind: 'nap' | 'night'`), Sec. 3.5 (tiempo despierto en Estado Actual), Sec. 6 (`type: 'sleep'`), CA-1 (duracion por timestamps sobreviviendo cierre/bloqueo), CA-3.
- **Alcance tecnico**:
  - Cronometro activo de sueno persistido en IndexedDB por `startedAt` UTC y `kind: 'nap' | 'night'` (nunca por contador en memoria), sobreviviendo cierre de PWA y bloqueo de pantalla.
  - Soporte para siestas (`nap`) y sueno nocturno (`night`), tanto con cronometro (inicio/fin) como con carga o edicion manual de `startedAt` / `endedAt` y `kind`.
  - Calculo puro (cubierto con Vitest) y visible en Estado Actual de: duracion del ultimo sueno y tiempo transcurrido desde el ultimo despertar (ventana de vigilia actual).

### Slice 5: Modulo de Alimentacion (Lactancia Dual con Intervalos, Mamadera y Extraccion)
- **Requisitos cubiertos**: Sec. 3.1 (Alimentacion), Sec. 3.5 ("hace cuanto" fue la ultima toma), Sec. 6 (`feeding_breast`, `feeding_bottle`, `pumping`), CA-1, CA-3.
- **Alcance tecnico**:
  - **Lactancia materna**: cronometros independientes para pecho izquierdo y derecho (iniciar, pausar, reanudar, finalizar). `startedAt` y `endedAt` marcan inicio y cierre del evento general, mientras `payload` registra intervalos `{ start: string, end: string | null }[]` por lado (`left` / `right`) para calcular duracion real con pausas tras cerrar la app; el indicador del ultimo lado utilizado se determina segun el intervalo mas reciente de la sesion, validado con Vitest.
  - **Mamadera / formula**: registro rapido de cantidad (`ml`), tipo (`leche materna`, `formula`, `otro`) y hora del evento.
  - **Extraccion**: registro de sesion con duracion y/o cantidad (`ml`) y lado opcional.
  - Integracion con tarjeta de Estado Actual ("hace cuanto" fue la ultima toma) y linea de tiempo editable/eliminable.

### Slice 6: Modulo de Salud, Crecimiento y Notas
- **Requisitos cubiertos**: Sec. 3.4 (Salud, Crecimiento y Notas; `health_med` con `medName` y `dose`), Sec. 6 (`health_temp`, `health_growth`, `health_med`, `note`), CA-3.
- **Alcance tecnico**:
  - Formularios rapidos para: Temperatura (°C + hora), Peso y Talla (mediciones con fecha para historial), Medicacion (`medName` + `dose` + hora) y Notas rapidas para comentar con el pediatra.
  - Visualizacion en linea de tiempo diaria e historial basico de mediciones de crecimiento, con soporte de edicion y borrado (`deletedAt`).

### Slice 7: Integracion Supabase (2 Cuidadores en `babyId` Preconfigurado + Sync Offline-First LWW)
- **Requisitos cubiertos**: Sec. 2 (Supabase Auth, BD relacional sin `syncStatus` remoto, prerrequisitos `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `babyId` preconfigurado, reasignacion de `babyId` y `createdBy` locales antes de sincronizar, cola de sync, LWW por `updatedAt` incluyendo `deletedAt`), CA-2, CA-3, CA-4.
- **Alcance tecnico**:
  - Esquema SQL en Supabase (`babies`, `baby_caregivers`, `baby_events` incluyendo `deleted_at` y sin columna `sync_status`) con politicas RLS para compartir registros del `babyId` preconfigurado entre los 2 cuidadores autenticados.
  - Autenticacion Supabase (configurada con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) con sesion persistida offline; al vincular la cuenta, reasignar tanto `babyId` como `createdBy` de los registros locales al `babyId` y `user.id` reales antes de sincronizar.
  - Cola de sincronizacion pendiente: empuja eventos `pending`/`error` al volver online/foco, ejecuta pull incremental por `updatedAt` y resuelve conflictos por last-write-wins (`updatedAt` ISO UTC sobre el mismo `id`, cubriendo ediciones y borrados `deletedAt`) validado con Vitest.
  - Indicador discreto de estado de sincronizacion en cabecera (`sincronizado`, `pendiente`, `offline`, `error`).

### Slice 8: Endurecimiento Offline, Rendimiento Gama de Entrada y Verificacion MVP
- **Requisitos cubiertos**: Sec. 1 (fluidez en Samsung Galaxy A07, sin anuncios, poca senal), Sec. 4 (sin funcionalidades v2+), CA-1 a CA-5 completos.
- **Alcance tecnico**:
  - Auditoria de tamano de bundle, cache offline completo en Service Worker y fluidez de render/scroll en viewport movil gama de entrada.
  - Suite Vitest completa + pruebas integrales de los 5 Criterios de Aceptacion (cronometros tras cierre con pausas, offline -> online, edicion/borrado `deletedAt` sin huerfanos, 2 cuidadores y persistencia de Modo Noche).
  - Verificacion explicita de no haber incluido alcance v2+ (sin predicciones de sueno, graficos clinicos complejos ni integraciones externas).

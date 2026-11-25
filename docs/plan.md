# Plan de Implementacion por Vertical Slices: Baby Tracker Core (MVP)

> Especificacion base: [docs/spec.md](./spec.md). Reglas SDD del repo: [AGENTS.md](../AGENTS.md).
> No se modificara ni creara codigo fuera del alcance de este plan hasta aprobar/ejecutar los slices.

## Cobertura de Requisitos de `docs/spec.md`
- **Sec. 1 (Objetivo y Contexto)**: PWA movil personal para 2 cuidadores en Android gama de entrada (ej. Samsung Galaxy A07), sin anuncios, online/offline, uso con una mano, Modo Noche suave.
- **Sec. 2 (Stack y Arquitectura Base)**: Vite + React + TypeScript, estilos con variables CSS (tema claro y modo noche activable/desactivable), Vitest para pruebas unitarias de logica; PWA instalable; Offline-First con IndexedDB local primero, timestamps ISO UTC, `babyId` y `createdBy` locales por defecto hasta vincular Supabase (reasignando ambos al `babyId` y `user.id` reales antes de sincronizar), cola de sincronizacion, `syncStatus` exclusivo del cliente y LWW por `updatedAt` con `UUID` generado en cliente; borrado logico con `deletedAt` + `updatedAt`. Prerrequisitos: Slices 1-6 solo Node.js/npm local; Slice 7 proyecto Supabase, `babyId` preconfigurado y `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_DEFAULT_BABY_ID`.
- **Sec. 2.1 (Seguridad, Privacidad y Dependencias)**: cero secretos/PII en Git (solo `.env.example` con placeholders, nunca `SUPABASE_SERVICE_ROLE_KEY` ni `babyId`/emails reales en codigo o SQL), RLS estricto por operacion en todas las tablas sin politicas abiertas, signups publicos deshabilitados en Supabase Auth, y uso exclusivo de librerias oficiales verificadas sin vulnerabilidades (`npm audit`).
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
4. **Seguridad por diseno y dependencias oficiales**: priorizar APIs nativas web (`IndexedDB`, `crypto.randomUUID()`, Service Worker, CSS variables), usar unicamente paquetes oficiales auditados con `npm audit` (0 vulnerabilidades) y nunca versionar datos sensibles ni dejar tablas sin RLS estricto.

---

## Mapa de Vertical Slices

### Slice 1: Esqueleto PWA Movil + Sistema de Tema con Variables CSS y Modo Noche
- **Requisitos cubiertos**: Sec. 1, Sec. 2 y 2.1 (Vite + React + TypeScript, variables CSS, Vitest, dependencias oficiales sin vulnerabilidades), Sec. 3.5 (Modo Noche), CA-5.
- **Alcance tecnico**:
  - Inicializar Vite + React + TypeScript (`strict`) con Vitest configurado, `.gitignore` estricto + `.env.example` y estructura modular (`domain/`, `storage/`, `sync/`, `ui/`).
  - Configurar `manifest.webmanifest` y Service Worker basico nativo para instalacion en Android y cache de shell/assets.
  - Implementar layout base optimizado para uso con una mano (controles principales en zona inferior/accesible) y sistema de temas con variables CSS (Claro / Modo Noche: fondo muy oscuro, alto contraste suave sin blancos brillantes ni destellos).
  - Interruptor visible de Modo Noche en cabecera, persistido en `localStorage` y pre-aplicado antes de montar React para evitar destellos al abrir la app.

### Slice 2: Base Local (`BabyEvent` + IndexedDB) y Registro Rapido de Panales con Contador "Hace Cuanto"
- **Requisitos cubiertos**: Sec. 2 y 2.1 (IndexedDB nativo sin wrappers no oficiales, validacion estricta de estructura/rangos/longitudes de `BabyEvent`, timestamps ISO UTC, `babyId`/`createdBy` locales por defecto, `UUID` con `crypto.randomUUID()`, `syncStatus` solo local, Vitest), Sec. 3.3 (Panales), Sec. 3.5 (resumen "hace cuanto" + linea de tiempo diaria agrupada por fecha local de `startedAt`), Sec. 6 (`BabyEvent` + `deletedAt: null` + `type: 'diaper'`), CA-2 (parte local offline).
- **Alcance tecnico**:
  - Definir tipos TypeScript y validadores runtime de `BabyEvent` (incluyendo `deletedAt: string | null`, limites de longitud de notas/textos y rangos numericos finitos), constantes genericas por defecto para `babyId` y `createdBy` locales (sin PII), generador `crypto.randomUUID()` y utilidades puras en Vitest para timestamps ISO UTC, agrupacion por fecha calendario en hora local del dispositivo (a partir de `startedAt`) y formato de tiempo relativo.
  - Capa minima de IndexedDB nativo (`events` store) con lectura/escritura inmediata sin red y marcado `syncStatus: 'pending'` (exclusivo del cliente).
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

### Slice 7: Integracion Segura con Supabase (2 Cuidadores + RLS Estricto + Sync Offline-First LWW)
- **Requisitos cubiertos**: Sec. 2 y 2.1 (cliente oficial `@supabase/supabase-js` auditado con `npm audit --audit-level=low`, variables `VITE_SUPABASE_URL` sobre HTTPS + `VITE_SUPABASE_ANON_KEY` + `VITE_DEFAULT_BABY_ID` fuera de Git, bloqueo de `SUPABASE_SERVICE_ROLE_KEY`/`sb_secret_*`/`sbp_*`, RLS estricto con `baby_caregivers` de solo lectura e inmutabilidad en `UPDATE`, `Disable Sign Ups`, higiene en logout, reasignacion de `babyId` y `createdBy` locales antes de sincronizar, cola de sync, LWW por `updatedAt` incluyendo `deletedAt`), CA-2, CA-3, CA-4.
- **Alcance tecnico**:
  - Instalar unicamente `@supabase/supabase-js` oficial y verificar `npm audit --audit-level=low` con 0 vulnerabilidades.
  - Esquema SQL parametrizable sin PII ni UUIDs reales hardcodeados (`babies`, `baby_caregivers`, `baby_events` con `deleted_at` y sin `sync_status`), con `ENABLE ROW LEVEL SECURITY` en todas las tablas:
    - Sin politicas abiertas (`USING (true)`) ni acceso `anon` no autenticado.
    - `baby_caregivers` de solo lectura (`SELECT` sobre `user_id = auth.uid()`), sin `INSERT`/`UPDATE`/`DELETE` desde cliente.
    - En `baby_events`, `SELECT`, `INSERT` y `UPDATE` (`USING` + `WITH CHECK`) restringidos a `auth.uid()` presente en `baby_caregivers` para ese `baby_id`, exigiendo `created_by = auth.uid()` en `INSERT`, inmutabilidad de `id`/`baby_id`/`created_by`/`created_at` en `UPDATE`, `DELETE` fisico denegado, `CHECK` de tamano en `payload` (`<= 4096` bytes) y cota de reloj futuro en `updated_at`.
  - Documentar y verificar cierre de registro publico (`Disable Sign Ups`) en Supabase Auth tras dar de alta las 2 cuentas de cuidadores.
  - Autenticacion Supabase con sesion persistida offline y cierre de sesion seguro (advirtiendo si quedan eventos `pending` antes de limpiar IndexedDB); al vincular la cuenta, reasignar tanto `babyId` como `createdBy` de los registros locales al `babyId` (`VITE_DEFAULT_BABY_ID`) y `user.id` reales antes de sincronizar.
  - Cola de sincronizacion pendiente y reconciliacion LWW por `updatedAt` ISO UTC sobre `id`, validada con Vitest.

### Slice 8: Endurecimiento Offline, Auditoria de Seguridad/Dependencias, Rendimiento y Verificacion MVP
- **Requisitos cubiertos**: Sec. 1 (fluidez en Samsung Galaxy A07, sin anuncios, poca senal), Sec. 2.1 (auditoria de secretos, RLS y `npm audit`), Sec. 4 (sin funcionalidades v2+), CA-1 a CA-5 completos.
- **Alcance tecnico**:
  - Auditoria de tamano de bundle, cache offline completo en Service Worker y fluidez de render/scroll en viewport movil gama de entrada.
  - Auditoria final de seguridad: `npm audit` sin vulnerabilidades, verificacion de que solo existan paquetes oficiales en `package.json`, revision de que no haya secretos/PII en el historial/archivos versionados y validacion de RLS + bloqueo de signups en Supabase.
  - Suite Vitest completa + pruebas integrales de los 5 Criterios de Aceptacion y verificacion de ausencia de alcance v2+.

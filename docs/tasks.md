# Tareas de Implementacion por Vertical Slices: Baby Tracker Core (MVP)

> Basado en [docs/spec.md](./spec.md) y [docs/plan.md](./plan.md). Reglas SDD en [AGENTS.md](../AGENTS.md).
> Estrategia: tareas pequeñas por **vertical slices**, priorizando esqueleto de la app, Modo Noche y registro local de pañales con contador "hace cuánto" antes de integrar Supabase.

## Prerrequisitos por Etapa
- **Slices 1–6 (nucleo local offline-first)**: solo requieren **Node.js / npm** local.
- **Slice 7 (integracion Supabase)**: requiere proyecto en **Supabase**, **`babyId` preconfigurado** en DB y variables **`VITE_SUPABASE_URL`** + **`VITE_SUPABASE_ANON_KEY`**.

## Cobertura de Requisitos de `docs/spec.md`
| Slice | Requisitos de `spec.md` cubiertos | Criterios de Aceptacion |
| :--- | :--- | :--- |
| Slice 1 | Sec. 1 (Android gama de entrada, una mano, sin anuncios, modo noche), Sec. 2 (Vite + React + TS, variables CSS, Vitest, PWA), Sec. 3.5 (Modo Noche) | CA-5 |
| Slice 2 | Sec. 2 (IndexedDB local primero, ISO UTC, `babyId`/`createdBy` locales por defecto, `UUID`, `syncStatus` solo local), Sec. 3.3 (Panales), Sec. 3.5 ("hace cuanto" + timeline por fecha local), Sec. 6 (`BabyEvent`, `deletedAt`, `diaper`) | CA-2 (local) |
| Slice 3 | Sec. 2 (`updatedAt`, `deletedAt`, LWW), Sec. 3.5 (timeline editable/eliminable + recalculo), Sec. 6 (`deletedAt`) | CA-3 |
| Slice 4 | Sec. 3.2 (Sueno con `kind: 'nap' | 'night'` + vigilia), Sec. 3.5 (tiempo despierto), Sec. 6 (`sleep`) | CA-1, CA-3 |
| Slice 5 | Sec. 3.1 (Lactancia dual con intervalos `{ start, end }` por lado y ultimo lado por intervalo mas reciente, Mamadera, Extraccion), Sec. 3.5 (ultima toma), Sec. 6 (`feeding_breast`, `feeding_bottle`, `pumping`) | CA-1, CA-3 |
| Slice 6 | Sec. 3.4 (Temperatura, Peso/Talla, Medicacion con `medName` y `dose`, Notas), Sec. 6 (`health_*`, `note`) | CA-3 |
| Slice 7 | Sec. 2 (Supabase Auth, BD sin `syncStatus` remoto, reasignacion de `babyId` y `createdBy` locales antes de sync, cola sync, LWW por `updatedAt`/`deletedAt`, prerrequisitos env), Sec. 6 | CA-2, CA-3, CA-4 |
| Slice 8 | Sec. 1 (Samsung Galaxy A07, poca senal), Sec. 4 (sin alcance v2+), Vitest integral | CA-1..CA-5 |

---

## Slice 1: Esqueleto de la App PWA y Modo Noche (Local)
- [x] **S1-T1: Bootstrap Vite + React + TypeScript + Vitest + PWA base**
  - Verificar entorno Node.js/npm local, inicializar proyecto Vite + React + TypeScript (`strict: true`), configurar **Vitest** para pruebas unitarias y crear estructura `domain/`, `storage/`, `sync/`, `ui/`.
  - Configurar `manifest.webmanifest`, iconos basicos, meta viewport movil y Service Worker para cache offline del shell.
  - *Cubre*: Sec. 1, Sec. 2 (Vite + React + TS, Vitest, PWA, prerrequisito Node.js/npm).
  - *Verificacion*: build limpio, `vitest run` operativo, manifest valido y apertura offline del shell base.
- [x] **S1-T2: Layout movil para una mano y pantalla principal esqueleto**
  - Construir contenedor principal pensado para pantallas compactas Android (controles primarios alcanzables con el pulgar en la zona inferior, cabecera compacta, cero dependencias pesadas).
  - Preparar tarjetas placeholder de "Estado Actual" y seccion "Hoy" (timeline).
  - *Cubre*: Sec. 1 (uso con una mano, fluidez gama de entrada), Sec. 3.5.
  - *Verificacion*: navegacion y botones utilizables con una mano en viewport 360x800 sin overflow horizontal.
- [ ] **S1-T3: Sistema de temas con variables CSS (Claro / Modo Noche sin destellos) (CA-5)**
  - Definir variables CSS para Tema Claro y Modo Noche (fondo muy oscuro, contraste suave, sin blancos puros ni destellos).
  - Agregar interruptor visible en cabecera para activar/desactivar Modo Noche al instante, persistido en `localStorage` y aplicado antes del primer render en `index.html`.
  - *Cubre*: Sec. 1, Sec. 2 (variables CSS), Sec. 3.5, **CA-5**.
  - *Verificacion*: cambio de paleta inmediato al tocar el interruptor y persistencia al recargar sin flash blanco.

## Slice 2: Registro Local de Panales + Contadores de "Hace Cuanto" (Local)
- [ ] **S2-T1: Contrato `BabyEvent`, defaults locales y utilidades de tiempo / fecha local / UUID**
  - Definir interfaces TypeScript de `BabyEvent` segun Sec. 6 de `spec.md` (incluyendo `deletedAt: string | null`, `sleep` con `kind: 'nap' | 'night'`, `health_med` con `medName` y `dose`, `feeding_breast` con intervalos por lado, y `diaper`).
  - Definir `babyId` y `createdBy` locales por defecto para uso previo a Supabase, generador de `UUID` en cliente, timestamps en ISO UTC y utilidades puras para agrupar eventos por fecha calendario en hora local del dispositivo (usando la hora local de `startedAt`) y formatear tiempo relativo ("hace 12 min", "hace 2 h 15 min").
  - *Cubre*: Sec. 2 (`babyId`/`createdBy` locales, ISO UTC, `UUID`, `updatedAt`, Vitest), Sec. 3.5, Sec. 6 (`BabyEvent`).
  - *Verificacion*: tests unitarios en Vitest de creacion de evento, agrupacion por fecha local (incluyendo horarios nocturnos cerca de medianoche) y formato de tiempos transcurridos.
- [ ] **S2-T2: Almacenamiento local IndexedDB (`events` store)**
  - Implementar wrapper liviano de IndexedDB con store `events` indexado por `startedAt` y `type`, guardando cada alta con `deletedAt: null` y `syncStatus: 'pending'` (exclusivo del cliente).
  - *Cubre*: Sec. 2 (Offline-First local primero, `syncStatus` local), **CA-2** (guardado instantaneo offline).
  - *Verificacion*: los eventos guardados sin red sobreviven recarga y cierre de la app.
- [ ] **S2-T3: Flujo rapido de Panales (1-2 toques)**
  - Crear acceso rapido en pantalla principal para registrar `pis`, `caca` o `ambos` en 1-2 toques, con hora por defecto "ahora" (ajustable) y nota breve opcional.
  - *Cubre*: Sec. 3.3, Sec. 6 (`type: 'diaper'`).
  - *Verificacion*: registrar un panal sin nota toma 1-2 toques y lo persiste al instante en IndexedDB.
- [ ] **S2-T4: Tarjeta de Estado Actual ("hace cuanto" ultimo panal) + Timeline del dia**
  - Mostrar en Estado Actual hace cuanto fue el ultimo panal y de que tipo fue, excluyendo registros con `deletedAt !== null` y actualizandose periodicamente en UI a partir de `startedAt`.
  - Renderizar la lista cronologica del dia agrupada por fecha calendario en hora local del dispositivo (segun `startedAt` local) con los panales activos.
  - *Cubre*: Sec. 3.5, Sec. 5 (CA-3).
  - *Verificacion*: tests Vitest del selector de ultimo panal y filtro por dia local + verificacion visual de actualizacion inmediata al registrar.

## Slice 3: Edicion, Borrado (`deletedAt`) y Recalculo de Estado en Timeline Local
- [ ] **S3-T1: Edicion de eventos locales desde la linea de tiempo**
  - Permitir abrir cualquier evento activo de la timeline diaria, modificar hora (`startedAt`), tipo o nota, actualizando `updatedAt` (ISO UTC) y `syncStatus: 'pending'`.
  - *Cubre*: Sec. 2, Sec. 3.5, **CA-3**.
  - *Verificacion*: cambiar la hora del ultimo panal recalcula inmediatamente el indicador "hace cuanto".
- [ ] **S3-T2: Borrado logico (`deletedAt` + `updatedAt`) y recalculo sin datos huerfanos**
  - Al borrar un evento desde la timeline, setear `deletedAt` y `updatedAt` con el timestamp ISO UTC actual (y `syncStatus: 'pending'`).
  - Excluir todo evento con `deletedAt !== null` de vistas, timeline y contadores activos, recalculando de inmediato Estado Actual.
  - *Cubre*: Sec. 2, Sec. 3.5, Sec. 6 (`deletedAt`), **CA-3**.
  - *Verificacion*: tests unitarios en Vitest de borrado logico y recalculo en cascada (al borrar el ultimo evento vuelve al anterior o a "sin registros" sin huerfanos).

## Slice 4: Sueno (Cronometro Persistente, Manual y Ventana de Vigilia)
- [ ] **S4-T1: Motor de cronometro persistente por timestamps (`sleep`)**
  - Persistir cronometro de sueno activo en IndexedDB (`startedAt` ISO UTC, `kind: 'nap' | 'night'`) y calcular duracion real por diferencia `Date.now() - startedAt`.
  - Al finalizar, guardar `BabyEvent` (`type: 'sleep'`) con `startedAt`, `endedAt` y `payload: { kind }`.
  - *Cubre*: Sec. 3.2, Sec. 6, **CA-1**.
  - *Verificacion*: tests Vitest de calculo de duracion + cerrar la PWA/bloquear pantalla durante el cronometro y reabrir mantiene la duracion real exacta.
- [ ] **S4-T2: Carga/edicion manual de sueno e indicadores de vigilia**
  - Agregar formulario rapido para cargar o editar manualmente inicio, fin y tipo (`nap` / `night`) de siestas/sueno nocturno.
  - Mostrar en Estado Actual la **ventana de vigilia actual** (tiempo desde el ultimo despertar) y la **duracion del ultimo sueno**, excluyendo eventos borrados (`deletedAt`).
  - *Cubre*: Sec. 3.2, Sec. 3.5, **CA-1**, **CA-3**.
  - *Verificacion*: tests Vitest de ventana de vigilia y duracion del ultimo sueno ante altas, ediciones y borrados.

## Slice 5: Alimentacion (Lactancia Dual con Intervalos, Mamadera y Extraccion)
- [ ] **S5-T1: Lactancia materna con cronometros independientes e intervalos `{ start, end }` por lado**
  - Implementar cronometros independientes para pecho izquierdo (`left`) y derecho (`right`) con iniciar, pausar, reanudar y finalizar.
  - `startedAt` y `endedAt` marcan inicio y cierre del evento; en `payload` de `feeding_breast` registrar intervalos `{ start, end: string | null }` por lado (`left` / `right`) para calcular duracion real con pausas aun tras cerrar la app.
  - Determinar y mostrar el indicador visible del **ultimo lado utilizado segun el intervalo mas reciente de la sesion**.
  - *Cubre*: Sec. 3.1, Sec. 6, **CA-1**.
  - *Verificacion*: tests Vitest de suma de intervalos con pausas y deteccion de ultimo lado por intervalo mas reciente + cerrar/reabrir la app durante o entre pausas conserva las duraciones exactas.
- [ ] **S5-T2: Mamadera / formula y Extraccion**
  - Formulario rapido de Mamadera (`feeding_bottle`): cantidad (`ml`), tipo (`leche materna`, `formula`, `otro`) y hora ajustable.
  - Formulario rapido de Extraccion (`pumping`): cronometro o duracion manual, cantidad (`ml`) y lado opcional.
  - *Cubre*: Sec. 3.1, Sec. 6.
  - *Verificacion*: ambos registros persisten localmente, aparecen en timeline y permiten edicion/borrado (`deletedAt`).
- [ ] **S5-T3: Indicador de Estado Actual "Ultima toma"**
  - Unificar calculo puro de la ultima toma (`feeding_breast` o `feeding_bottle`, excluyendo `deletedAt !== null`) en la tarjeta de Estado Actual ("hace cuanto", detalle breve y ultimo pecho segun intervalo mas reciente si aplica).
  - *Cubre*: Sec. 3.1, Sec. 3.5, **CA-3**.
  - *Verificacion*: tests Vitest de calculo de ultima toma + verificacion en UI al editar o borrar.

## Slice 6: Salud, Crecimiento y Notas para Pediatra
- [ ] **S6-T1: Temperatura y Medicacion**
  - Formularios rapidos para Temperatura (`health_temp`: valor en °C + hora) y Medicacion (`health_med`: `medName` + `dose` + hora).
  - *Cubre*: Sec. 3.4, Sec. 6.
  - *Verificacion*: registro offline, visualizacion en timeline diaria, edicion y borrado (`deletedAt`).
- [ ] **S6-T2: Peso, Talla y Notas rapidas**
  - Formulario de Crecimiento (`health_growth`: peso kg / talla cm con fecha) con vista de historial cronologico simple.
  - Formulario de Notas rapidas (`note`: texto corto asociado a momento o dia para comentar con el pediatra).
  - *Cubre*: Sec. 3.4, Sec. 6, Sec. 4 (sin graficos clinicos avanzados).
  - *Verificacion*: mediciones y notas persisten en IndexedDB y son editables/eliminables.

## Slice 7: Integracion Supabase (2 Cuidadores en `babyId` Preconfigurado + Sync Offline-First LWW)
- [ ] **S7-T1: Esquema SQL y politicas RLS en Supabase**
  - Verificar prerrequisitos (proyecto Supabase, `babyId` preconfigurado, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
  - Crear tablas `babies`, `baby_caregivers` y `baby_events` (con `deleted_at` y **sin** columna `sync_status`, ya que `syncStatus` es exclusivo del cliente) + RLS para que ambos cuidadores vinculados al `babyId` preconfigurado lean y escriban los mismos registros (**CA-4**).
  - *Cubre*: Sec. 2 (`syncStatus` solo local, prerrequisitos), **CA-4**.
  - *Verificacion*: pruebas de acceso verificando comparticion entre las 2 cuentas vinculadas al `babyId` preconfigurado y bloqueo a terceros.
- [ ] **S7-T2: Autenticacion de cuidadores y reasignacion de registros locales (`babyId` y `createdBy`)**
  - Integrar login de Supabase Auth para ambos cuidadores manteniendo sesion persistida offline.
  - Al vincular la cuenta, reasignar tanto `babyId` como `createdBy` de los registros locales al `babyId` preconfigurado y al `user.id` reales antes de sincronizar.
  - *Cubre*: Sec. 2 (reasignacion de `babyId` y `createdBy`), **CA-2**, **CA-4**.
  - *Verificacion*: tests Vitest de migracion de registros locales + verificacion de que tras reasignar no quedan `babyId`/`createdBy` locales en la cola y la app sigue operando sin red.
- [ ] **S7-T3: Cola de sincronizacion pendiente y reconciliacion LWW (`updatedAt` / `deletedAt`)**
  - Enviar eventos locales con `syncStatus: 'pending' | 'error'` a Supabase (mapeando sin `syncStatus`) al recuperar red o volver al frente; marcar `'synced'` localmente al confirmar.
  - Descargar cambios remotos por `updatedAt` aplicando resolucion LWW comparando `updatedAt` (ISO UTC) sobre `id`, tanto para ediciones como para borrados (`deletedAt`).
  - Mostrar estado discreto de sync en cabecera.
  - *Cubre*: Sec. 2, **CA-2**, **CA-3**, **CA-4**.
  - *Verificacion*: tests Vitest de merge LWW (incluyendo conflictos edicion vs borrado por `updatedAt`) + prueba offline -> online entre dos cuidadores sin datos huerfanos.

## Slice 8: Optimizacion Android Gama de Entrada y Cierre MVP
- [ ] **S8-T1: Verificacion integral de Criterios de Aceptacion (CA-1 a CA-5)**
  - Ejecutar suite completa de **Vitest** y pruebas end-to-end manuales cubriendo: cronometros con pausas tras cierre, offline -> online, edicion/borrado `deletedAt` sin huerfanos, dos cuidadores compartiendo el `babyId` preconfigurado y persistencia de Modo Noche.
  - *Cubre*: Sec. 5 (**CA-1** a **CA-5**).
  - *Verificacion*: toda la suite Vitest y los 5 criterios pasan sin regresiones.
- [ ] **S8-T2: Auditoria de rendimiento (Samsung Galaxy A07) y alcance MVP**
  - Verificar peso de bundle JS/CSS, tiempo de arranque offline, respuesta tactil de 1-2 toques y ausencia total de anuncios o features v2+ (predicciones, graficos clinicos complejos, integraciones externas).
  - *Cubre*: Sec. 1, Sec. 4.
  - *Verificacion*: app liviana, fluida en dispositivo gama de entrada y 100% acotada al MVP.

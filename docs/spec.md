# Especificacion del Producto: Baby Tracker Core (MVP)

## 1. Objetivo y Contexto
Aplicacion movil personal para el seguimiento diario del bebe, compartida entre dos cuidadores en dispositivos Android (objetivo de rendimiento fluido en equipos de gama de entrada como Samsung Galaxy A07).
Debe funcionar sin anuncios, con soporte online y offline ante poca senal, interfaz simple para uso con una mano y modo noche activable/desactivable con iluminacion suave.

## 2. Stack y Arquitectura Base
- Tipo de aplicacion: PWA instalable en Android, optimizada para bajo consumo y carga rapida.
- Frontend: Vite + React + TypeScript, estilos con variables CSS (tema claro y modo noche activable/desactivable) de bajo peso visual.
- Pruebas unitarias de logica: Vitest (duraciones, contadores, borrado y resolucion de conflictos LWW).
- Backend y base de datos: Supabase (autenticacion para ambos cuidadores, base de datos relacional y sincronizacion).
- Prerrequisitos por etapa:
  - Slices 1-6 (nucleo local offline-first): solo requieren Node.js/npm local.
  - Slice 7 (integracion Supabase): requiere proyecto en Supabase, `babyId` preconfigurado y variables de entorno `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_DEFAULT_BABY_ID` (nunca hardcodeadas en codigo ni migraciones).
- Estrategia Offline-First, fechas y vinculacion:
  - Toda accion del usuario se guarda primero en almacenamiento local (IndexedDB o equivalente) para respuesta inmediata sin red.
  - Timestamps: guardar todos los timestamps en ISO UTC para LWW y trazabilidad.
  - Antes de conectar Supabase se usan `babyId` y `createdBy` locales por defecto; al vincular con Supabase (app personal de 2 cuidadores), se vinculan ambos usuarios al `babyId` preconfigurado (`VITE_DEFAULT_BABY_ID` / DB) y se reasignan tanto `babyId` como `createdBy` de los registros locales al `babyId` y `user.id` reales antes de sincronizar.
  - Cola de sincronizacion pendiente que envia cambios a Supabase cuando hay conexion. `syncStatus` es exclusivo del almacenamiento local del cliente y no forma parte del esquema remoto de Supabase.
  - Resolucion de conflictos: last-write-wins (LWW) basado en `updatedAt` (ISO timestamp UTC) sobre el mismo registro (`id`), priorizando eventos independientes con `UUID` generado en cliente. Al borrar un evento se setea `deletedAt` y `updatedAt` con el timestamp actual; LWW compara `updatedAt` y los eventos con `deletedAt` no nulo se excluyen de vistas y contadores activos.

### 2.1. Seguridad, Privacidad y Dependencias
- **Proteccion de secretos y datos sensibles en el repositorio**:
  - Prohibido subir al repositorio archivos `.env*` reales, claves privadas, tokens, credenciales, emails reales de los cuidadores, datos reales del bebe o el `babyId` real de produccion en codigo fuente o scripts SQL versionados. Solo se versiona `.env.example` con placeholders vacios.
  - Prohibido exponer o incluir `SUPABASE_SERVICE_ROLE_KEY` en el frontend o en el repositorio (el cliente web opera unicamente con `VITE_SUPABASE_ANON_KEY` bajo RLS).
- **Seguridad de Base de Datos y Autenticacion (Supabase)**:
  - **RLS obligatorio**: `ENABLE ROW LEVEL SECURITY` activo en todas las tablas (`babies`, `baby_caregivers`, `baby_events`), sin politicas abiertas (`USING (true)`) ni acceso `anon` sin sesion autenticada.
  - **Minimo privilegio por operacion**: `SELECT`, `INSERT` y `UPDATE` permitidos unicamente cuando `auth.uid()` pertenece a `baby_caregivers` para ese `baby_id`; `INSERT` debe validar `created_by = auth.uid()`; `DELETE` fisico denegado en `baby_events` (el borrado es exclusivamente logico mediante `deleted_at`).
  - **Registro cerrado**: deshabilitar el alta publica de usuarios (`Disable Sign Ups`) en Supabase Auth una vez creadas las 2 cuentas de los cuidadores.
- **Seguridad y procedencia de librerias (Supply Chain)**:
  - Usar exclusivamente paquetes oficiales y mantenidos de cada ecosistema (React, Vite, TypeScript, Vitest y `@supabase/supabase-js` oficial) priorizando APIs nativas de la plataforma web (`IndexedDB`, `crypto.randomUUID()`, Service Worker, CSS variables).
  - Prohibido instalar librerias no oficiales, forks de terceros sin respaldo o paquetes con vulnerabilidades conocidas que afecten al proyecto. Toda incorporacion o actualizacion de dependencias debe verificarse con `npm audit` sin vulnerabilidades activas.

## 3. Modulos del MVP

### 3.1. Alimentacion
- Lactancia materna:
  - Cronometros independientes para pecho izquierdo y derecho (iniciar, pausar, reanudar, finalizar).
  - `startedAt` y `endedAt` marcan inicio y cierre del evento, y en el `payload` de `feeding_breast` se registran intervalos `{ start, end: string | null }` por lado (`left` / `right`) para calcular la duracion real con pausas incluso tras cerrar la app.
  - Indicador visible de cual fue el ultimo lado utilizado, determinado segun el intervalo mas reciente de la sesion.
- Mamadera / formula:
  - Registro rapido de cantidad (ml), tipo (leche materna, formula u otro) y hora del evento.
- Extraccion:
  - Registro de sesion de extraccion (duracion y/o cantidad en ml y lado si aplica).

### 3.2. Sueno
- Registro de siestas y sueno nocturno (`payload` de `sleep` incluye `kind: 'nap' | 'night'`).
- Soporte para cronometro activo (inicio/fin) y carga o edicion manual de horario de inicio y fin.
- Calculo visible del tiempo transcurrido desde el ultimo despertar (ventana de vigilia actual) y duracion del ultimo sueno.

### 3.3. Panales
- Registro rapido (idealmente 1 a 2 toques) para: pis, caca o ambos.
- Hora del evento ajustable (por defecto ahora) y nota breve opcional.

### 3.4. Salud, Crecimiento y Notas
- Temperatura: registro de valor (ej. °C) y hora.
- Peso y talla: registro de mediciones con fecha para seguimiento historico.
- Medicacion: registro de dosis y medicamento administrado (`payload` de `health_med` incluye `medName` y `dose`) y hora.
- Notas rapidas: texto corto asociado a un momento o dia para comentar con el pediatra.

### 3.5. Estado Actual, Historial y Modo Noche
- Pantalla principal con resumen de estado actual ("hace cuanto" fue la ultima toma, ultimo panal y tiempo despierto) y linea de tiempo diaria editable/eliminable.
- La linea de tiempo diaria se agrupa por fecha calendario en hora local del dispositivo (usando la hora local de inicio del evento, `startedAt`, como criterio base).
- Interruptor visible para activar y desactivar el Modo Noche en cualquier momento.
- Modo Noche: fondo muy oscuro, alto contraste suave sin blancos brillantes ni destellos, pensado para entornos con poca luz.

## 4. Fuera de Alcance del MVP (v2+)
- Prediccion algoritmica de sueno o alertas automaticas complejas.
- Graficos clinicos avanzados o comparativas complejas de percentiles.
- Integraciones externas (bots, wearables, exportaciones elaboradas).

## 5. Criterios de Aceptacion Clave
1. Cronometros de lactancia y sueno calculan la duracion real por diferencia de marcas de tiempo (`startedAt` / `endedAt` en sueno y evento general, e intervalos `{ start, end }` por lado `left` / `right` en el `payload` de `feeding_breast`), sobreviviendo al cierre de la app o bloqueo de pantalla incluso con pausas.
2. Registrar una toma, panal, sueno o dato de salud sin internet guarda el registro localmente al instante y lo sincroniza con Supabase al recuperar conexion.
3. Editar o borrar un evento actualiza el historial y recalcula los indicadores de estado ("hace cuanto") sin dejar datos huerfanos; el borrado setea `deletedAt` y `updatedAt` con el timestamp actual y excluye el evento de vistas y contadores activos.
4. Dos cuidadores autenticados ven y actualizan los mismos registros compartidos del bebe.
5. Activar o desactivar el Modo Noche cambia la paleta de inmediato y persiste la preferencia del usuario.

## 6. Modelo de Datos Minimo (Referencia)
- `BabyEvent`:
  - `id`: string (UUID generado en cliente)
  - `babyId`: string
  - `type`: `'feeding_breast' | 'feeding_bottle' | 'pumping' | 'sleep' | 'diaper' | 'health_temp' | 'health_growth' | 'health_med' | 'note'`
  - `startedAt`: string (ISO timestamp UTC)
  - `endedAt`: string | null (ISO timestamp UTC cuando aplica)
  - `payload`: objeto JSON especifico del tipo de evento (ej. `side`, `left`, `right` con intervalos `{ start, end: string | null }[]`, `amountMl`, `kind: 'nap' | 'night'` en `sleep`, `diaperKind`, `tempC`, `weightKg`, `heightCm`, `medName` y `dose` en `health_med`, `text`)
  - `createdBy`: string (userId)
  - `createdAt`: string (ISO timestamp UTC)
  - `updatedAt`: string (ISO timestamp UTC)
  - `deletedAt`: string | null (ISO timestamp UTC)
  - `syncStatus`: `'synced' | 'pending' | 'error'` (exclusivo del almacenamiento local del cliente; no forma parte del esquema remoto de Supabase)

# Reglas del Repositorio — Guardián Spec-Driven Development (SDD)

Este proyecto sigue **Spec-Driven Development** sobre la tríada documental:
1. [docs/spec.md](./docs/spec.md) — Fuente de verdad del producto, alcance MVP, modelo de datos y criterios de aceptación.
2. [docs/plan.md](./docs/plan.md) — Arquitectura técnica y secuencia por *vertical slices*.
3. [docs/tasks.md](./docs/tasks.md) — Tareas pequeñas, verificables y trazadas a `spec.md`.

## Reglas Obligatorias para Agentes y Colaboradores

1. **Lectura previa obligatoria**
   - Antes de escribir o modificar código, leer `docs/spec.md`, `docs/plan.md` y `docs/tasks.md`.
   - Ningún cambio de código debe contradecir el contrato `BabyEvent`, las decisiones cerradas de arquitectura ni los 5 criterios de aceptación de `docs/spec.md`.

2. **Respeto estricto al alcance del MVP**
   - Mantener fuera del código cualquier funcionalidad listada en la Sec. 4 de `docs/spec.md` (Fuera de Alcance v2+: predicción algorítmica de sueño, alertas automáticas complejas, gráficos clínicos avanzados/percentiles e integraciones externas).
   - No introducir dependencias pesadas que degraden la fluidez en dispositivos Android de gama de entrada (ej. Samsung Galaxy A07) ni anuncios.

3. **Aviso ante desvíos o ambigüedades**
   - Si una tarea requiere modificar el modelo de datos, el alcance, el stack o las reglas de sincronización/borrado, **detenerse y avisar antes de implementarlo**.
   - Si se aprueba un cambio, actualizar primero `docs/spec.md` (y luego `docs/plan.md` / `docs/tasks.md`) antes de tocar el código.

4. **Ejecución por vertical slices pequeños**
   - Trabajar un slice/tarea pequeña por vez siguiendo el orden de `docs/tasks.md` (primero núcleo local y offline-first, luego integración Supabase).
   - Cada slice debe dejar la app compilando, con pruebas unitarias en **Vitest** para la lógica introducida (duraciones, contadores, borrado, LWW) y verificación explícita de sus criterios de aceptación.
   - Al completar una tarea, marcar su checkbox en `docs/tasks.md` solo después de haberla verificado.

5. **Seguridad de datos sensibles y accesos a Base de Datos**
   - **Cero secretos o PII en Git**: nunca commitear archivos `.env*` reales (solo `.env.example` con valores vacíos/ficticios), tokens, claves privadas, `SUPABASE_SERVICE_ROLE_KEY`, emails reales de cuidadores, nombres/datos reales del bebé ni el `babyId` real de producción hardcodeado en código o migraciones SQL.
   - **Nunca dejar accesos abiertos a la BD**: toda tabla en Supabase debe tener `ENABLE ROW LEVEL SECURITY` activo desde su creación, sin políticas abiertas (`USING (true)` ni acceso `anon` no autenticado). Exigir pertenencia de `auth.uid()` en `baby_caregivers`, validar `created_by = auth.uid()` en `INSERT`, denegar `DELETE` físico en `baby_events` y mantener deshabilitado el registro público (`Disable Sign Ups`) en Supabase Auth tras crear las 2 cuentas.

6. **Política estricta de dependencias (solo oficiales y sin vulnerabilidades)**
   - Utilizar únicamente librerías **oficiales y mantenidas** del stack aprobado (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@supabase/supabase-js`) y preferir APIs nativas del navegador (`IndexedDB`, `crypto.randomUUID()`, `Service Worker`, variables CSS) antes que paquetes externos.
   - **Prohibido** instalar librerías no oficiales, paquetes abandonados/dudosos o dependencias con vulnerabilidades conocidas que puedan afectar al proyecto.
   - Ejecutar y verificar `npm audit` cada vez que se agregue o actualice una dependencia; si aparece una vulnerabilidad aplicable sin remediación limpia, no incorporar el paquete y avisar al usuario.

7. **Seguridad en el Cliente (CSP / XSS / Service Worker) y Checklist Pre-Commit**
   - **Compatibilidad con CSP estricto**: el build de producción inyecta `Content-Security-Policy` con `script-src 'self'` y `style-src 'self'` (sin `'unsafe-inline'`). No usar scripts inline en `index.html`, `eval` ni `dangerouslySetInnerHTML`; para scripts tempranos (como inicialización de tema) usar archivos estáticos del mismo origen (ej. `/theme-init.js`).
   - **Service Worker seguro**: cachear únicamente rutas estáticas conocidas del mismo origen sin query strings (`url.search === ''`), para no persistir callbacks ni tokens de autenticación en Cache Storage.
   - **Definition of Done antes de cada commit**:
     1. `npm run typecheck` (`tsc -b --noEmit`) pasa sin errores.
     2. `npm test` (`vitest run`) pasa al 100%.
     3. `npm run build` compila limpio.
     4. `npm audit` reporta `0 vulnerabilities` (obligatorio si cambió `package.json` / `package-lock.json`).
     5. Revisión de `git status` / `git diff` confirmando ausencia de secretos, claves privadas o PII.

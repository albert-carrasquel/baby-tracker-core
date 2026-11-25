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

5. **Seguridad de datos sensibles, validación y accesos a Base de Datos**
   - **Cero secretos o PII en Git**: nunca commitear archivos `.env*` reales (solo `.env.example` con placeholders), tokens, claves privadas, claves privilegiadas de Supabase (`SUPABASE_SERVICE_ROLE_KEY`, JWT `service_role`, `sb_secret_*`, `sbp_*`), URIs de PostgreSQL, emails reales de cuidadores, nombres/datos reales del bebé ni el `babyId` real de producción hardcodeado en código o migraciones SQL. `VITE_SUPABASE_URL` debe usar HTTPS.
   - **Validación estricta de dominio y sanitización**: validar en runtime la estructura, tipos, rangos numéricos finitos y longitudes máximas de texto de todo `BabyEvent` y `payload` (tanto al crear en UI como al deserializar desde IndexedDB o Supabase), rechazando claves peligrosas (`__proto__`, `constructor`) o timestamps inválidos.
   - **Nunca dejar accesos abiertos ni escalables en BD**:
     - `ENABLE ROW LEVEL SECURITY` obligatorio en todas las tablas, sin `USING (true)` ni acceso `anon` sin sesión.
     - `baby_caregivers` de **solo lectura (`SELECT`)** para clientes autenticados (`user_id = auth.uid()`), sin políticas `INSERT`/`UPDATE`/`DELETE` desde cliente.
     - En `baby_events`, exigir `USING` y `WITH CHECK` por membresía en `baby_caregivers`, exigir `created_by = auth.uid()` en `INSERT`, impedir mutar columnas de identidad (`id`, `baby_id`, `created_by`, `created_at`) en `UPDATE`, denegar `DELETE` físico, limitar tamaño de `payload` (`<= 4096` bytes) y acotar reloj futuro en `updated_at` (`<= now() + interval '5 minutes'`).
     - Mantener `Disable Sign Ups` en Supabase Auth tras crear las 2 cuentas y limpiar datos locales sensibles al cerrar sesión explícitamente (advirtiendo si hay eventos `pending`).

6. **Política estricta de dependencias (solo oficiales y sin vulnerabilidades)**
   - Utilizar únicamente librerías **oficiales y mantenidas** del stack aprobado (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@supabase/supabase-js`) con versiones exactas (`save-exact=true`) y preferir APIs nativas del navegador (`IndexedDB`, `crypto.randomUUID()`, `Service Worker`, variables CSS) antes que paquetes externos.
   - **Prohibido** instalar librerías no oficiales, paquetes abandonados/dudosos o dependencias con vulnerabilidades conocidas que puedan afectar al proyecto.
   - Ejecutar y verificar `npm audit --audit-level=low` cada vez que se agregue o actualice una dependencia; si aparece una vulnerabilidad aplicable sin remediación limpia, no incorporar el paquete y avisar al usuario.

7. **Seguridad en el Cliente (CSP / XSS / Service Worker) y Checklist Pre-Commit**
   - **Compatibilidad con CSP estricto y acotado**: el build de producción inyecta `Content-Security-Policy` con `script-src 'self'`, `style-src 'self'` y `connect-src` restringido únicamente a `'self'` y al origen exacto de `VITE_SUPABASE_URL` (nunca comodines `*.supabase.co`). No usar scripts/estilos inline, `eval` ni `dangerouslySetInnerHTML`.
   - **Service Worker seguro**: cachear únicamente rutas estáticas conocidas del mismo origen sin query strings (`url.search === ''`), invalidando caché con hash de contenido completo del shell y bundles.
   - **Definition of Done antes de cada commit**:
     1. `npm run typecheck` (`tsc -b --noEmit`) pasa sin errores.
     2. `npm test` (`vitest run`) pasa al 100%.
     3. `npm run build` compila limpio.
     4. `npm audit --audit-level=low` reporta `0 vulnerabilities` (obligatorio si cambió `package.json` / `package-lock.json`).
     5. Revisión de `git status` / `git diff` confirmando ausencia de secretos, claves privadas o PII.

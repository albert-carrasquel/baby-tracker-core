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

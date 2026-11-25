# 🍼 Baby Tracker Core

Aplicación móvil personal (PWA) para el seguimiento diario del bebé, compartida entre dos cuidadores en dispositivos Android — optimizada para gama de entrada (Samsung Galaxy A07).

> **Estado actual:** MVP en desarrollo activo · Slice 1 completado · Slice 2 en progreso (`S2-T1`)

## ✨ Características del MVP

- **Alimentación** — Lactancia materna con cronómetros independientes (izquierdo/derecho con pausas), mamadera (ml, tipo) y extracción.
- **Sueño** — Cronómetro persistente para siestas y sueño nocturno, carga manual y ventana de vigilia en tiempo real.
- **Pañales** — Registro ultra-rápido en 1–2 toques (pis, caca o ambos) con hora ajustable y nota opcional.
- **Salud y crecimiento** — Temperatura, peso/talla, medicación y notas rápidas para el pediatra.
- **Estado actual** — Resumen en vivo ("hace cuánto" fue la última toma, último pañal y tiempo despierto) con línea de tiempo diaria editable/eliminable.
- **Modo Noche** — Paleta oscura de contraste suave sin destellos, activable/desactivable al instante y persistente.
- **Offline-First** — Toda acción se guarda localmente al instante (IndexedDB) y se sincroniza con Supabase al recuperar conexión (LWW por `updatedAt`).
- **Dos cuidadores** — Ambos padres autenticados ven y actualizan los mismos registros compartidos del bebé.

## 🛠️ Stack

| Capa | Tecnología |
| :--- | :--- |
| Frontend | Vite + React + TypeScript (strict) |
| Estilos | Variables CSS (tema claro / modo noche) |
| Persistencia local | IndexedDB (offline-first) |
| Backend y sync | Supabase (Auth + PostgreSQL + Realtime) |
| Tests | Vitest |
| Distribución | PWA instalable en Android |

## 🚀 Inicio rápido

```bash
# Clonar el repositorio
git clone git@github.com:albert-carrasquel/baby-tracker-core.git
cd baby-tracker-core

# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Tests
npm test

# Build de producción
npm run build
```

## 📁 Estructura del proyecto

```
baby-tracker-core/
├── docs/
│   ├── spec.md          # Especificación del producto (fuente de verdad)
│   ├── plan.md          # Arquitectura y secuencia por vertical slices
│   └── tasks.md         # Tareas pequeñas y verificables
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js            # Service Worker para cache offline
│   └── icons/
├── src/
│   ├── domain/          # Modelo de dominio y lógica pura
│   ├── storage/         # Persistencia local (IndexedDB)
│   ├── sync/            # Cola de sincronización y reconciliación LWW
│   └── ui/              # Componentes React y estilos
├── AGENTS.md            # Reglas SDD del repositorio
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 📋 Metodología: Spec-Driven Development

Este proyecto sigue **Spec-Driven Development (SDD)** con una tríada documental:

1. **[docs/spec.md](docs/spec.md)** — Fuente de verdad del producto, alcance MVP, modelo de datos y criterios de aceptación.
2. **[docs/plan.md](docs/plan.md)** — Arquitectura técnica y secuencia de entrega por vertical slices.
3. **[docs/tasks.md](docs/tasks.md)** — Tareas pequeñas, verificables y trazadas a la especificación.

Las reglas para agentes y colaboradores están en **[AGENTS.md](AGENTS.md)**.

### Vertical Slices

| Slice | Descripción | Estado |
| :---: | :--- | :---: |
| 1 | Esqueleto PWA + Layout móvil + Modo Noche | ✅ |
| 2 | `BabyEvent` + IndexedDB + Pañales + "Hace cuánto" | 🔧 |
| 3 | Edición, borrado (`deletedAt`) y recálculo | ⏳ |
| 4 | Sueño (cronómetro persistente + vigilia) | ⏳ |
| 5 | Alimentación (lactancia dual + mamadera + extracción) | ⏳ |
| 6 | Salud, crecimiento y notas | ⏳ |
| 7 | Integración Supabase (auth + sync LWW) | ⏳ |
| 8 | Rendimiento gama de entrada + verificación MVP | ⏳ |

## 🔒 Seguridad por Diseño

- **Guardia automática de entorno ([envGuard.ts](src/domain/envGuard.ts))**: el build/servidor aborta si detecta variables `VITE_*` con nombres sensibles (`SERVICE_ROLE`, `SECRET`, `PRIVATE`, `PASSWORD`), claves secretas (`sb_secret_*`, `sbp_*`, JWT `service_role`, claves PEM, URIs PostgreSQL) o endpoints remotos sin HTTPS.
- **CSP estricto y acotado**: el HTML de producción bloquea scripts/estilos inline (`script-src 'self'; style-src 'self'`) y restringe `connect-src` únicamente al origen exacto configurado en `VITE_SUPABASE_URL` (sin comodines `*.supabase.co`).
- **Service Worker seguro**: solo cachea rutas estáticas conocidas sin query strings (`url.search === ''`), evitando persistir callbacks o tokens en Cache Storage, e invalida cachés mediante hash SHA-256 del shell y bundles.
- **Base de datos y Auth cerradas (Slice 7)**: RLS obligatorio en todas las tablas, `baby_caregivers` de solo lectura desde cliente, `UPDATE` con `USING` + `WITH CHECK` e inmutabilidad de identidad, borrado exclusivamente lógico (`deleted_at`), límite de tamaño en `payload` JSONB y registro público deshabilitado (`Disable Sign Ups`).
- **Supply chain**: solo dependencias oficiales con versiones exactas (`.npmrc` `save-exact=true`) y auditoría automática en CI (`npm audit --audit-level=low` + escaneo de patrones secretos).

## 📄 Licencia

Proyecto personal de uso privado.

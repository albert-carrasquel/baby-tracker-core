import { useEffect, useState } from 'react';
import { APP_METADATA, formatShellStatus } from '../domain/appInfo';
import {
  THEME_META_COLORS,
  parseThemeMode,
  persistTheme,
  readStoredTheme,
  toggleThemeMode,
  type ThemeMode,
} from '../domain/theme';
import './App.css';

function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset['theme'] = mode;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', THEME_META_COLORS[mode]);
  }
}

function getInitialThemeFromDomOrStorage(): ThemeMode {
  if (typeof document !== 'undefined') {
    const domTheme = parseThemeMode(document.documentElement.dataset['theme']);
    if (domTheme !== null) {
      return domTheme;
    }
  }

  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const storage =
    typeof window !== 'undefined' ? window.localStorage : undefined;

  return readStoredTheme(storage, prefersDark);
}

export function App() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [theme, setTheme] = useState<ThemeMode>(getInitialThemeFromDomOrStorage);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleToggleNightMode = () => {
    const next = toggleThemeMode(theme);
    applyThemeToDocument(next);
    persistTheme(
      typeof window !== 'undefined' ? window.localStorage : undefined,
      next,
    );
    setTheme(next);
  };

  const isNightMode = theme === 'night';

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">{APP_METADATA.name}</h1>
        <div className="app-header__actions">
          <span
            className="app-header__status"
            role="status"
            aria-live="polite"
            title={formatShellStatus(isOnline)}
          >
            <span aria-hidden="true">{isOnline ? '●' : '○'}</span>{' '}
            {isOnline ? 'En línea' : 'Sin red'}
          </span>

          <button
            type="button"
            className="theme-toggle-btn"
            aria-pressed={isNightMode}
            aria-label={
              isNightMode ? 'Desactivar modo noche' : 'Activar modo noche'
            }
            onClick={handleToggleNightMode}
          >
            <span aria-hidden="true">{isNightMode ? '🌙' : '☀️'}</span>
            <span>Noche</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <section aria-labelledby="status-heading">
          <h2 id="status-heading" className="status-section__heading">
            Estado actual
          </h2>
          <div className="status-cards">
            <StatusCard icon="🍼" label="Última toma" value="—" />
            <StatusCard icon="🧷" label="Último pañal" value="—" />
            <StatusCard icon="😴" label="Vigilia" value="—" />
          </div>
        </section>

        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="timeline-section__heading">
            Hoy
          </h2>
          <div className="timeline">
            <p className="timeline-empty">
              Sin registros todavía. Usá los botones de abajo para empezar.
            </p>
          </div>
        </section>
      </main>

      <nav className="quick-actions" aria-label="Acciones rápidas">
        <QuickActionButton icon="🍼" label="Toma" />
        <QuickActionButton icon="😴" label="Sueño" />
        <QuickActionButton icon="🧷" label="Pañal" />
        <QuickActionButton icon="📝" label="Salud" />
      </nav>
    </>
  );
}

function StatusCard(props: { icon: string; label: string; value: string }) {
  return (
    <div className="status-card">
      <span className="status-card__icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="status-card__label">{props.label}</span>
      <span className="status-card__value">{props.value}</span>
    </div>
  );
}

function QuickActionButton(props: { icon: string; label: string }) {
  return (
    <button type="button" className="quick-action-btn">
      <span className="quick-action-btn__icon" aria-hidden="true">
        {props.icon}
      </span>
      {props.label}
    </button>
  );
}

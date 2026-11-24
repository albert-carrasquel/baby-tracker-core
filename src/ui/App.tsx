import { useEffect, useState } from 'react';
import './App.css';

/* ------------------------------------------------------------------ */
/*  App Shell — S1-T2: mobile layout for one-handed use (360×800+)    */
/*  Cabecera compacta + tarjetas Estado Actual (placeholder) +        */
/*  timeline "Hoy" (placeholder) + barra de acciones rápidas en la    */
/*  zona del pulgar (bottom).                                         */
/* ------------------------------------------------------------------ */

export function App() {
  /* ---- Connectivity state (from S1-T1, kept for header badge) ---- */
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

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

  return (
    <>
      {/* ---- Header ------------------------------------------------ */}
      <header className="app-header">
        <span className="app-header__title">Baby Tracker</span>
        <div className="app-header__actions">
          <span className="app-header__status">
            {isOnline ? '●' : '○'} {isOnline ? 'Online' : 'Offline'}
          </span>
          {/* S1-T3: night-mode toggle will be placed here */}
        </div>
      </header>

      {/* ---- Scrollable content ------------------------------------ */}
      <main className="app-main">
        {/* Estado Actual — placeholder cards */}
        <section>
          <h2 className="status-section__heading">Estado actual</h2>
          <div className="status-cards">
            <StatusCard icon="🍼" label="Última toma" value="—" />
            <StatusCard icon="🧷" label="Último pañal" value="—" />
            <StatusCard icon="😴" label="Vigilia" value="—" />
          </div>
        </section>

        {/* Timeline del día — placeholder */}
        <section>
          <h2 className="timeline-section__heading">Hoy</h2>
          <div className="timeline">
            <p className="timeline-empty">
              Sin registros todavía. Usá los botones de abajo para empezar.
            </p>
          </div>
        </section>
      </main>

      {/* ---- Quick-action bar (thumb zone) ------------------------- */}
      <nav className="quick-actions" aria-label="Acciones rápidas">
        <QuickActionButton icon="🍼" label="Toma" />
        <QuickActionButton icon="😴" label="Sueño" />
        <QuickActionButton icon="🧷" label="Pañal" />
        <QuickActionButton icon="📝" label="Salud" />
      </nav>
    </>
  );
}

/* ---- Tiny presentational sub-components (no separate files yet) --- */

function StatusCard(props: { icon: string; label: string; value: string }) {
  return (
    <div className="status-card">
      <span className="status-card__icon">{props.icon}</span>
      <span className="status-card__label">{props.label}</span>
      <span className="status-card__value">{props.value}</span>
    </div>
  );
}

function QuickActionButton(props: { icon: string; label: string }) {
  return (
    <button type="button" className="quick-action-btn">
      <span className="quick-action-btn__icon">{props.icon}</span>
      {props.label}
    </button>
  );
}

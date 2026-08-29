import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { THEMES, ThemeId, ThemeDef } from '../../themes/themes';

interface SettingsModalProps {
  currentThemeId: ThemeId;
  onThemeChange:  (id: ThemeId) => void;
  onClose:        () => void;
}

// ── Theme Preview Card ────────────────────────────────────────────────────────
function ThemeCard({
  theme,
  isActive,
  onSelect,
}: {
  theme:    ThemeDef;
  isActive: boolean;
  onSelect: () => void;
}) {
  const v = theme.vars;

  return (
    <button
      className={`settings-theme-card${isActive ? ' active' : ''}`}
      onClick={onSelect}
      title={theme.description}
      aria-pressed={isActive}
    >
      {/* Mini UI preview */}
      <div
        className="stc-preview"
        style={{ background: v['--bg'] }}
      >
        {/* Simulated header strip */}
        <div className="stc-header" style={{ borderBottomColor: v['--grid'] }}>
          <div className="stc-brand">
            <div className="stc-dot" style={{ background: v['--network'] }} />
            <div className="stc-dot" style={{ background: v['--network'], opacity: 0.4, width: '28px' }} />
          </div>
          <div className="stc-toggle" style={{ borderColor: v['--grid'] }}>
            <div className="stc-toggle-btn" style={{ background: v['--panel'], color: v['--network'] }} />
            <div className="stc-toggle-btn" style={{ background: 'transparent', opacity: 0.4 }} />
          </div>
        </div>

        {/* Simulated layout */}
        <div className="stc-body">
          {/* Left rail */}
          <div className="stc-rail">
            <div className="stc-panel" style={{ background: v['--panel'], borderColor: v['--grid'] }}>
              <div className="stc-line stc-line--label" style={{ background: v['--muted-2'] }} />
              <div className="stc-cidr-row">
                <div className="stc-line" style={{ background: v['--text'], width: '55%' }} />
                <div className="stc-line" style={{ background: v['--network'], width: '22%', opacity: 0.9 }} />
              </div>
              <div className="stc-facts">
                {[v['--text'], v['--muted'], v['--network'], v['--host']].map((c, i) => (
                  <div key={i} className="stc-fact-row">
                    <div className="stc-line" style={{ background: v['--muted-2'], width: '40%', opacity: 0.7 }} />
                    <div className="stc-line" style={{ background: c, width: '35%' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main col */}
          <div className="stc-main">
            {/* BitRuler panel */}
            <div className="stc-panel stc-panel--ruler" style={{ background: v['--panel'], borderColor: v['--grid'] }}>
              <div className="stc-bits">
                {Array.from({ length: 16 }, (_, i) => (
                  <div
                    key={i}
                    className="stc-bit"
                    style={{
                      background: i < 6
                        ? v['--base-fixed-dim']
                        : i < 10
                        ? v['--host-dim']
                        : v['--host-dim'],
                      borderTop: `2px solid ${i < 6 ? v['--base-fixed'] : v['--host']}`,
                      opacity: i < 6 ? 1 : 0.6,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* BlockMap panel */}
            <div className="stc-panel" style={{ background: v['--panel'], borderColor: v['--grid'] }}>
              <div className="stc-blocks">
                {[
                  { flex: 4, color: v['--host'] },
                  { flex: 2, color: v['--network'] },
                  { flex: 3, color: v['--borrowed'] },
                  { flex: 1, color: v['--muted-2'] },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="stc-block"
                    style={{
                      flex: b.flex,
                      background: v['--panel-2'],
                      borderColor: v['--grid'],
                      borderTop: `2px solid ${b.color}`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="stc-footer">
        <div className="stc-footer__left">
          <span className="stc-name">{theme.name}</span>
          <span className="stc-desc">{theme.description}</span>
        </div>
        <div className="stc-accents">
          {theme.noise.accentColors.slice(0, 4).map((c, i) => (
            <div key={i} className="stc-accent-dot" style={{ background: c }} />
          ))}
        </div>
        {isActive && (
          <div className="stc-check">✓</div>
        )}
      </div>
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentThemeId,
  onThemeChange,
  onClose,
}) => {
  // Close on Escape key
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const el = document.getElementById('settings-modal-root');
  if (!el) return null;

  return ReactDOM.createPortal(
    <div className="settings-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="settings-modal__header">
          <div className="settings-modal__title">
            <span className="settings-modal__icon">⚙</span>
            <span>Settings</span>
          </div>
          <button className="settings-modal__close" onClick={onClose} title="Close (Esc)">×</button>
        </div>

        {/* Section: Appearance */}
        <div className="settings-section">
          <div className="settings-section__label">Color Theme</div>
          <div className="settings-theme-grid">
            {THEMES.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={theme.id === currentThemeId}
                onSelect={() => onThemeChange(theme.id)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-modal__footer">
          <span className="mono" style={{ color: 'var(--muted-2)', fontSize: '10px' }}>
            Preference saved to localStorage
          </span>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    el
  );
};

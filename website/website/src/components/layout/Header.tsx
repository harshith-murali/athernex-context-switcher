'use client';

import { UserButton } from '@clerk/nextjs';
import { useTheme } from '@/components/ThemeProvider';
import { ViewType } from '@/app/page';

interface HeaderProps {
  activeView: ViewType;
  setActiveView: (v: ViewType) => void;
}

const navItems: { id: ViewType; label: string; }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'priming', label: 'Priming Prompt' },
  { id: 'settings', label: 'Settings' },
];

export default function Header({ activeView, setActiveView }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="top-nav">
      {/* ── Left: Logo & Nav Links ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div className="nav-logo">
          <div className="logo-icon-small">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.04em', fontSize: 18, marginRight: 8 }}>ContextMind</span>
        </div>

        <div className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-pill ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Extensions & CTA ── */}
      <div className="nav-actions">
        <div className="ext-chips">
          <ExtChip label="VS Code" active />
          <ExtChip label="Chrome" active />
          <ExtChip label="MongoDB" active />
        </div>
        
        <div className="divider" />

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <UserButton
          appearance={{
            elements: { avatarBox: 'clerk-avatar-small' },
          }}
        />
      </div>
    </header>
  );
}

function ExtChip({ label, active, port }: { label: string; active: boolean; port?: string }) {
  return (
    <div className="ext-chip">
      <div className={`ext-dot ${active ? 'active' : ''}`} />
      <span>{label}</span>
      {port && <span style={{ opacity: 0.5, marginLeft: 2 }}>:{port}</span>}
    </div>
  );
}

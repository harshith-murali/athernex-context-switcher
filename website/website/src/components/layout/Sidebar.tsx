'use client';

import { ViewType } from '@/app/page';
import { useSettings } from '@/components/SettingsProvider';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (v: ViewType) => void;
  isOpen: boolean;
}

const navItems: {
  id: ViewType;
  label: string;
  icon: string;
  badge?: number;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'sessions', label: 'Sessions', icon: '◉', badge: 3 },
  { id: 'priming', label: 'Priming Prompt', icon: '⟡' },
  { id: 'settings', label: 'Settings', icon: '◎' },
];

export default function Sidebar({ activeView, setActiveView, isOpen }: SidebarProps) {
  const { settings } = useSettings();
  if (!isOpen) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="white" />
              <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
          </div>
          <div>
            <div className="logo-name">ContextMind</div>
            <div className="logo-tag">AI Context System</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Navigation</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.badge !== undefined && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </button>
        ))}

        <div className="nav-label" style={{ marginTop: 16 }}>Extensions</div>
        <div style={{ padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ExtBadge label="VS Code" status="connected" port={settings.port} />
          <ExtBadge label="Chrome" status="connected" port="" />
          <ExtBadge label="FastAPI" status="running" port={`:${settings.port}`} />
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="status-chip">
          <div className="status-dot" />
          <span className="status-label">Bridge online</span>
          <span className="status-port">:{settings.port}</span>
        </div>
      </div>
    </aside>
  );
}

function ExtBadge({ label, status, port }: { label: string; status: string; port: string }) {
  const color = status === 'connected' || status === 'running' ? 'var(--accent-success)' : 'var(--accent-warn)';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 8px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{port}</span>
    </div>
  );
}

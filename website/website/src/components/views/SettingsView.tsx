'use client';

import { useState } from 'react';
import { useSettings } from '@/components/SettingsProvider';

export default function SettingsView() {
  const { settings, updateSettings, saveSettings, hasUnsavedChanges } = useSettings();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const maxTokens = parseInt(settings.maxTokens) || 1400;

  return (
    <div style={{ maxWidth: 1200, width: '100%' }}>
      <SettingsSection title="Local Extension Bridge" subtitle="Express backend running on your machine — used by VS Code & Chrome extensions only (not the website)">
        <SettingsRow label="Port" desc="Both extensions hardcode port 37218 — this setting is informational only">
          <input
            type="text"
            value={settings.port}
            onChange={(e) => updateSettings({ port: e.target.value })}
            style={inputStyle}
          />
        </SettingsRow>
        <SettingsRow label="Session window (min)" desc="Payloads sent within this window are merged into one session">
          <input
            type="number"
            value={settings.sessionWindow}
            onChange={(e) => updateSettings({ sessionWindow: e.target.value })}
            style={{ ...inputStyle, width: 80 }}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="ML Pipeline" subtitle="Context builder token budget">
        <SettingsRow label="Max token budget" desc="Hard cap for priming prompt output">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min="800"
              max="2000"
              step="100"
              value={settings.maxTokens}
              onChange={(e) => updateSettings({ maxTokens: e.target.value })}
              style={{ width: 160 }}
            />
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 50 }}>
              {maxTokens.toLocaleString()}
            </span>
          </div>
        </SettingsRow>

        <div style={{ margin: '12px 0', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Layer budget allocation
          </div>
          {[
            { l: 'L1 Ground truth', t: 300, p: 1 },
            { l: 'L3 Hard constraints', t: 150, p: 2 },
            { l: 'L4 Recent context', t: 400, p: 3 },
            { l: 'L2 Current state', t: 300, p: 4 },
            { l: 'L5 Historical', t: 250, p: 5 },
          ].map((item) => (
            <div key={item.l} style={{ display: 'grid', gridTemplateColumns: '160px 60px 1fr', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.l}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>~{item.t}t</span>
              <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${(item.t / maxTokens) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Chrome Extension" subtitle="Tab classification and filtering">
        <SettingsRow label="Noise domains" desc="These domains are unchecked by default in the tab picker">
          <textarea
            value={settings.noiseDomains}
            onChange={(e) => updateSettings({ noiseDomains: e.target.value })}
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 72,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          />
        </SettingsRow>

        <SettingsRow label="AI domains (always checked)" desc="These tabs are fully scraped and compressed">
          <div style={{
            padding: '8px 12px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            claude.ai, chat.openai.com, gemini.google.com, cursor.sh, perplexity.ai
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="VS Code Extension" subtitle="Capture settings">
        <SettingsRow label="Max file lines captured" desc="First N lines of each open file sent to bridge">
          <input
            type="number"
            value={settings.maxFileLines}
            onChange={(e) => updateSettings({ maxFileLines: e.target.value })}
            style={{ ...inputStyle, width: 100 }}
          />
        </SettingsRow>
        <SettingsRow label="Max git diff lines" desc="Lines of git diff HEAD included in payload">
          <input
            type="number"
            value={settings.maxGitDiffLines}
            onChange={(e) => updateSettings({ maxGitDiffLines: e.target.value })}
            style={{ ...inputStyle, width: 100 }}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 8 }}>
        {hasUnsavedChanges && (
          <span style={{ fontSize: 11, color: 'var(--accent-warn)', fontStyle: 'italic' }}>
            Unsaved changes
          </span>
        )}
        <button
          className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
          onClick={handleSave}
          style={{ minWidth: 120 }}
        >
          {saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-mid)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 10px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
};

function SettingsSection({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function SettingsRow({ label, desc, children }: {
  label: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

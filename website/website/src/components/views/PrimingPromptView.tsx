'use client';

import { useState, useEffect, useCallback } from 'react';

interface Workspace {
  workspaceId: string;
  name: string;
  lastUpdated: number;
}

interface PromptResult {
  prompt: string;
  tokenEstimate: number;
  name: string;
}

interface SavedPrompt {
  id: string;
  workspaceName: string;
  prompt: string;
  tokenEstimate: number;
  createdAt: number;
}

const STORAGE_KEY = 'contextmind_recent_prompts';
const MAX_SAVED   = 5;

function loadSavedPrompts(): SavedPrompt[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function persistPrompt(p: SavedPrompt) {
  const all = [p, ...loadSavedPrompts()].slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Syntax highlighting for the prompt display ────────────────────────────────

function HighlightedPrompt({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.75 }}>
      {lines.map((line, i) => {
        // Double-rule header
        if (/^═+$/.test(line)) {
          return <div key={i} style={{ color: '#6b7280', userSelect: 'none' }}>{line}</div>;
        }
        if (/^─+$/.test(line)) {
          return <div key={i} style={{ color: '#374151', userSelect: 'none' }}>{line}</div>;
        }
        // Section titles (between rule lines)
        if (/^\s{2}[A-Z\s:]+$/.test(line) && line.trim().length > 2) {
          return <div key={i} style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.05em' }}>{line}</div>;
        }
        // Code fence
        if (line.startsWith('```')) {
          return <div key={i} style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{line}</div>;
        }
        // [YOU] / [ASSISTANT] labels
        if (/^\[(YOU|ASSISTANT)\]/.test(line)) {
          const isUser = line.startsWith('[YOU]');
          return (
            <div key={i} style={{
              color: isUser ? '#60a5fa' : 'var(--accent)',
              fontWeight: 700, marginTop: 10,
            }}>{line}</div>
          );
        }
        // Bullet points
        if (/^  [•▸✗]/.test(line)) {
          const isError = line.includes('✗');
          return <div key={i} style={{ color: isError ? 'var(--accent-danger)' : 'var(--text-secondary)', paddingLeft: 8 }}>{line}</div>;
        }
        // Key-value lines like "Goal:", "Progress:"
        if (/^(Goal|Progress|Last task|Tech Stack):/.test(line.trim())) {
          return (
            <div key={i}>
              <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{line.split(':')[0]}:</span>
              <span style={{ color: 'var(--text-primary)' }}>{line.slice(line.indexOf(':') + 1)}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ color: 'var(--text-secondary)' }}>{line}</div>;
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PrimingPromptView() {
  const [workspaces, setWorkspaces]   = useState<Workspace[]>([]);
  const [selectedWid, setSelectedWid] = useState('');
  const [result, setResult]           = useState<PromptResult | null>(null);
  const [generating, setGenerating]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [savedPrompts, setSaved]      = useState<SavedPrompt[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch('/api/context')
      .then(r => r.json())
      .then(d => {
        const list: Workspace[] = d.workspaces ?? [];
        setWorkspaces(list);
        if (list.length > 0) setSelectedWid(list[0].workspaceId);
      })
      .catch(() => {});
    setSaved(loadSavedPrompts());
  }, []);

  const generate = useCallback(async () => {
    if (!selectedWid) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/context/${selectedWid}/prompt`);
      if (!res.ok) return;
      const data = await res.json() as PromptResult;
      setResult(data);

      const saved: SavedPrompt = {
        id: Date.now().toString(),
        workspaceName: data.name,
        prompt: data.prompt,
        tokenEstimate: data.tokenEstimate,
        createdAt: Date.now(),
      };
      persistPrompt(saved);
      setSaved(loadSavedPrompts());
    } finally {
      setGenerating(false);
    }
  }, [selectedWid]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const tokenPct   = result ? Math.min((result.tokenEstimate / 8000) * 100, 100) : 0;
  const tokenColor = tokenPct > 85 ? 'var(--accent-danger)' : tokenPct > 60 ? 'var(--accent-warn)' : 'var(--accent-success)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

      {/* ── Main prompt panel ── */}
      <div className="card" style={{ padding: 28 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
              Generate Priming Prompt
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {result
                ? `~${result.tokenEstimate.toLocaleString()} tokens · ready to paste`
                : 'Builds from VS Code + ChatGPT + browser context'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {result && (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }}
                onClick={() => setResult(null)}>
                Clear
              </button>
            )}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '7px 16px',
                background: copied ? 'var(--accent-success)' : 'var(--accent)',
                color: 'white',
                opacity: !result ? 0.5 : 1,
                cursor: !result ? 'not-allowed' : 'pointer',
              }}
              onClick={handleCopy}
              disabled={!result}
            >
              {copied ? '✓ Copied to clipboard' : 'Copy Prompt'}
            </button>
          </div>
        </div>

        {/* Workspace selector + generate */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <select
            value={selectedWid}
            onChange={e => setSelectedWid(e.target.value)}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--border-mid)', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {workspaces.length === 0 && <option value="">No workspaces yet</option>}
            {workspaces.map(w => (
              <option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '8px 22px', whiteSpace: 'nowrap' }}
            onClick={generate}
            disabled={generating || !selectedWid}
          >
            {generating ? 'Building…' : '⚡ Generate'}
          </button>
        </div>

        {/* Token progress bar */}
        {result && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Token usage (8k context estimate)</span>
              <span style={{ color: tokenColor, fontWeight: 600 }}>{result.tokenEstimate.toLocaleString()} tokens</span>
            </div>
            <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tokenPct}%`, background: tokenColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Empty / loading state */}
        {!result && !generating && (
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            border: '2px dashed var(--border-mid)', borderRadius: 12,
            color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8,
          }}>
            Select a workspace and click Generate.<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>
              Includes VS Code file, ChatGPT history, browser tabs, and a structured handoff instruction.
            </span>
          </div>
        )}

        {generating && (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }} className="pulse">
              Assembling context from all sources…
            </div>
          </div>
        )}

        {/* Prompt display */}
        {result && !generating && (
          <div style={{
            background: 'var(--bg-hover)', borderRadius: 10,
            padding: '16px 20px', maxHeight: 560, overflowY: 'auto',
          }}>
            <HighlightedPrompt text={result.prompt} />
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Open in AI */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Open in
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Claude.ai',  url: 'https://claude.ai/new',          note: 'Best for long context' },
              { name: 'ChatGPT',   url: 'https://chatgpt.com/',            note: 'GPT-4o' },
              { name: 'Gemini',    url: 'https://gemini.google.com/',      note: 'Google' },
              { name: 'Perplexity', url: 'https://www.perplexity.ai/',     note: 'w/ search' },
            ].map(p => (
              <button
                key={p.name}
                className="btn btn-secondary"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '8px 12px' }}
                onClick={() => {
                  handleCopy();
                  setTimeout(() => window.open(p.url, '_blank'), 200);
                }}
              >
                <span>→ {p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.note}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
            Copies prompt then opens the AI in a new tab.
          </div>
        </div>

        {/* Recent prompts */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Recent</div>
            <button
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setShowHistory(h => !h)}
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>

          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedPrompts.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No prompts yet.</div>
              )}
              {savedPrompts.map(p => (
                <div
                  key={p.id}
                  style={{
                    padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 8,
                    cursor: 'pointer', border: '1px solid transparent', transition: 'border-color 0.15s',
                  }}
                  onClick={() => setResult({ prompt: p.prompt, tokenEstimate: p.tokenEstimate, name: p.workspaceName })}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {p.workspaceName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · ~'}{p.tokenEstimate.toLocaleString()} tokens
                  </div>
                </div>
              ))}
              {savedPrompts.length > 0 && (
                <button
                  style={{ fontSize: 11, color: 'var(--accent-danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                  onClick={() => { localStorage.removeItem(STORAGE_KEY); setSaved([]); }}
                >
                  Clear history
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Tips</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '⚡', text: 'Auto-saves every ChatGPT response when workspace is set.' },
              { icon: '📁', text: 'Save from VS Code extension to include your active file.' },
              { icon: '📋', text: 'Paste the prompt at the start of a new conversation.' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0 }}>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

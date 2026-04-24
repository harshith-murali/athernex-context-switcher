'use client';

import { useState, useEffect, useCallback } from 'react';

interface Workspace {
  workspaceId: string;
  name: string;
  lastUpdated: number;
}

interface WorkspaceContext {
  code: {
    activeFile: { path: string; language: string; snippet: string } | null;
    relatedFiles: { path: string; language: string; snippet: string }[];
  };
  browser: { title: string; url: string; snippet: string }[];
  chatSummary: {
    goal: string;
    decisions: string[];
    constraints: string[];
    progress: string;
    nextSteps: string[];
  } | null;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [ctx, setCtx] = useState<WorkspaceContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today'>('all');

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/context');
      if (!res.ok) return;
      const data = await res.json();
      const list: Workspace[] = data.workspaces ?? [];
      setWorkspaces(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } catch { /* offline */ }
  }, [selected]);

  const fetchCtx = useCallback(async (wid: string) => {
    setLoading(true);
    setCtx(null);
    try {
      const res = await fetch(`/api/context/${wid}`);
      if (!res.ok) return;
      setCtx(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);



  const copyPrompt = async () => {
    if (!ctx || !selected) return;
    const prompt = buildPrompt(selected, ctx);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { if (selected) fetchCtx(selected.workspaceId); }, [selected, fetchCtx]);

  const filtered = workspaces.filter((w) => {
    if (filter === 'today') return Date.now() - w.lastUpdated < 86400000;
    return true;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, minHeight: 'calc(100vh - 140px)' }}>

      {/* ── Left: Workspace List ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="tabs">
            {(['all', 'today'] as const).map((f) => (
              <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : 'Today'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} workspace{filtered.length !== 1 ? 's' : ''}</span>
        </div>



        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              No workspaces found.<br />Save context from VS Code or Chrome.
            </div>
          )}
          {filtered.map((w) => (
            <div
              key={w.workspaceId}
              className={`session-card ${selected?.workspaceId === w.workspaceId ? 'active-session' : ''}`}
              onClick={() => setSelected(w)}
              style={{ padding: 18, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                  {timeAgo(w.lastUpdated)}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {w.workspaceId.slice(0, 18)}…
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Workspace Detail ── */}
      <div>
        {!selected ? (
          <div className="card" style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Select a workspace</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
              Click a workspace on the left to view its context.
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="card" style={{ marginBottom: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {selected.name}
                  </h2>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {selected.workspaceId}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => fetchCtx(selected.workspaceId)}>
                    Refresh
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 13, padding: '8px 14px' }}
                    onClick={copyPrompt}
                    disabled={!ctx}
                  >
                    {copied ? '✓ Copied!' : 'Copy Prompt'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Last updated: {timeAgo(selected.lastUpdated)}
              </div>
            </div>

            {loading && (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div className="pulse" style={{ color: 'var(--text-muted)' }}>Loading context…</div>
              </div>
            )}

            {!loading && ctx && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Code section */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--accent)' }}>⌨</span> Code
                  </div>
                  {ctx.code.activeFile ? (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: 'var(--accent-dim)', color: 'var(--accent)', textTransform: 'uppercase',
                        }}>Active</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {ctx.code.activeFile.path.split(/[\\\/]/).pop()}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ctx.code.activeFile.language}</span>
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-hover)',
                        borderRadius: 8, padding: '12px 14px', overflow: 'auto',
                        maxHeight: 120, color: 'var(--text-secondary)', margin: 0,
                        borderLeft: '3px solid var(--accent)', whiteSpace: 'pre-wrap',
                      }}>
                        {ctx.code.activeFile.snippet || '(empty)'}
                      </pre>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active file captured</div>
                  )}

                  {ctx.code.relatedFiles.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Related files</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ctx.code.relatedFiles.map((f, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            background: 'var(--bg-hover)', borderRadius: 8,
                          }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                              {f.path.split(/[\\\/]/).pop()}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.language}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Browser section */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#3b82f6' }}>🌐</span> Browser Tabs
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>top {ctx.browser.length}</span>
                  </div>
                  {ctx.browser.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No browser tabs captured</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {ctx.browser.map((tab, i) => (
                        <div key={i} style={{
                          padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 10,
                          borderLeft: '3px solid #3b82f6',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                            {tab.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {tab.url?.replace(/^https?:\/\//, '')}
                          </div>
                          {tab.snippet && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {tab.snippet.slice(0, 120)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat summary section */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#ec4899' }}>💬</span> Chat Summary
                  </div>
                  {!ctx.chatSummary?.goal ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No chat data captured yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'Goal', value: ctx.chatSummary.goal, color: 'var(--accent)' },
                        { label: 'Progress', value: ctx.chatSummary.progress, color: 'var(--accent-warn)' },
                      ].map(({ label, value, color }) => value ? (
                        <div key={label} style={{
                          padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 10,
                          borderLeft: `3px solid ${color}`,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{value}</div>
                        </div>
                      ) : null)}
                      {(ctx.chatSummary.decisions?.length > 0) && (
                        <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 10, borderLeft: '3px solid var(--accent-success)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Decisions</div>
                          <ul style={{ paddingLeft: 16, margin: 0 }}>
                            {ctx.chatSummary.decisions.slice(0, 3).map((d, i) => (
                              <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3, lineHeight: 1.5 }}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ctx.chatSummary.nextSteps?.length > 0 && (
                        <div style={{ padding: '12px 14px', background: 'rgba(139,92,246,0.06)', borderRadius: 10, borderLeft: '3px solid var(--accent)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>→</span>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Next Step</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ctx.chatSummary.nextSteps[0]}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildPrompt(workspace: Workspace, ctx: WorkspaceContext): string {
  const lines: string[] = [
    `# Context Handoff — ${workspace.name}`,
    `Workspace: ${workspace.workspaceId}`,
    '',
  ];

  if (ctx.code.activeFile) {
    lines.push(`## Active File`);
    lines.push(`${ctx.code.activeFile.path} (${ctx.code.activeFile.language})`);
    lines.push('```');
    lines.push(ctx.code.activeFile.snippet);
    lines.push('```');
    lines.push('');
  }

  if (ctx.code.relatedFiles.length > 0) {
    lines.push(`## Related Files`);
    ctx.code.relatedFiles.forEach(f => lines.push(`- ${f.path} (${f.language})`));
    lines.push('');
  }

  if (ctx.browser.length > 0) {
    lines.push('## Browser Context');
    ctx.browser.forEach(t => {
      lines.push(`- ${t.title}`);
      lines.push(`  ${t.url}`);
    });
    lines.push('');
  }

  if (ctx.chatSummary?.goal) {
    lines.push('## Chat Summary');
    lines.push(`Goal: ${ctx.chatSummary.goal}`);
    if (ctx.chatSummary.progress) lines.push(`Progress: ${ctx.chatSummary.progress}`);
    if (ctx.chatSummary.nextSteps?.[0]) lines.push(`Next: ${ctx.chatSummary.nextSteps[0]}`);
    lines.push('');
  }

  lines.push('## Instructions');
  lines.push('You have full context above. Continue from where we left off. Do not ask for information already provided.');

  return lines.join('\n');
}

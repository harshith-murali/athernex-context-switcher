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

export default function DashboardView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeCtx, setActiveCtx] = useState<WorkspaceContext | null>(null);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyWorkspaceId = async (wid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(wid);
    setCopiedId(wid);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [status, setStatus] = useState<'ok' | 'error' | 'loading'>('loading');


  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/context');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: Workspace[] = data.workspaces ?? [];
      setWorkspaces(list);
      setStatus('ok');
      if (list.length > 0 && !selected) {
        setSelected(list[0]);
      }
    } catch {
      setStatus('error');
    }
  }, [selected]);

  const fetchContext = useCallback(async (wid: string) => {
    try {
      const res = await fetch(`/api/context/${wid}`);
      if (!res.ok) return;
      setActiveCtx(await res.json());
    } catch {
      setActiveCtx(null);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { if (selected) fetchContext(selected.workspaceId); }, [selected, fetchContext]);


  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>

      {/* ── Hero ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'center', marginTop: 16 }}>
        <div>
          <div className="liquid-glass" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 30, fontSize: 13, fontWeight: 600,
            color: status === 'ok' ? 'var(--accent-success)' : status === 'error' ? 'var(--accent-danger)' : 'var(--accent)',
            marginBottom: 24,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status === 'ok' ? 'var(--accent-success)' : status === 'error' ? 'var(--accent-danger)' : 'var(--accent)',
              boxShadow: status === 'ok' ? '0 0 8px var(--accent-success)' : 'none',
            }} />
            {status === 'ok' ? 'Database Connected' : status === 'error' ? 'Database Offline' : 'Connecting…'}
          </div>
          <h1 className="h1" style={{ fontSize: 46 }}>Your developer<br />context, always intact.</h1>
          <p className="subtitle" style={{ maxWidth: 480 }}>
            Capture active files, browser tabs, and chat summaries. Resume any session
            instantly with one click.
          </p>
          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            {selected && (
              <button
                className="btn btn-secondary"
                onClick={() => fetchContext(selected.workspaceId)}
              >
                Refresh Context
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Workspaces</div>
            <div className="stat-value">{workspaces.length}</div>
            <div className="stat-change up">Active sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Browser Tabs</div>
            <div className="stat-value">{activeCtx?.browser?.length ?? 0}</div>
            <div className="stat-change up">In active workspace</div>
          </div>
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-label">Code Files Tracked</div>
            <div className="stat-value">
              {(activeCtx?.code?.activeFile ? 1 : 0) + (activeCtx?.code?.relatedFiles?.length ?? 0)}
            </div>
            <div className="stat-change down">In active workspace</div>
          </div>
        </div>
      </div>

      {/* ── Active Workspace Context ── */}
      {selected && activeCtx && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <h2 className="h2" style={{ marginBottom: 4 }}>Active Workspace</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {selected.name} · {timeAgo(selected.lastUpdated)}
              </p>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--text-muted)', padding: '4px 10px',
              background: 'var(--bg-hover)', borderRadius: 8,
            }}>
              {selected.workspaceId.slice(0, 16)}…
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

            {/* Code card */}
            <div className="box-purple" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Active File
              </div>
              {activeCtx.code.activeFile ? (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {activeCtx.code.activeFile.path.split(/[\\\/]/).pop()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {activeCtx.code.activeFile.language}
                  </div>
                  <pre style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
                    background: 'var(--bg-hover)', borderRadius: 8, padding: 10,
                    overflow: 'hidden', maxHeight: 80, margin: 0, whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {activeCtx.code.activeFile.snippet}
                  </pre>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No file captured yet</div>
              )}
            </div>

            {/* Browser card */}
            <div className="box-blue" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Browser Tabs
              </div>
              {activeCtx.browser.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeCtx.browser.slice(0, 3).map((tab, i) => (
                    <div key={i} style={{ borderBottom: i < activeCtx.browser.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < activeCtx.browser.length - 1 ? 10 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {tab.title?.slice(0, 40)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {tab.url?.replace(/^https?:\/\//, '').slice(0, 40)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tabs captured yet</div>
              )}
            </div>

            {/* Chat summary card */}
            <div className="box-pink" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Chat Summary
              </div>
              {activeCtx.chatSummary?.goal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Goal</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{activeCtx.chatSummary.goal.slice(0, 80)}</div>
                  </div>
                  {activeCtx.chatSummary.progress && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Progress</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{activeCtx.chatSummary.progress.slice(0, 80)}</div>
                    </div>
                  )}
                  {activeCtx.chatSummary.nextSteps?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Next</div>
                      <div style={{ fontSize: 12, color: 'var(--accent)' }}>{activeCtx.chatSummary.nextSteps[0]?.slice(0, 80)}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No chat data yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Workspaces List ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <h2 className="h2" style={{ marginBottom: 4 }}>All Workspaces</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Click any workspace to load its context.</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={fetchWorkspaces}>
            Refresh
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No workspaces yet</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Save context from the <strong>Chrome extension</strong> or <strong>VS Code</strong> to create your first workspace.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {workspaces.map((w) => (
              <div
                key={w.workspaceId}
                className={`session-card ${selected?.workspaceId === w.workspaceId ? 'active-session' : ''}`}
                onClick={() => setSelected(w)}
                style={{ cursor: 'pointer', padding: 20 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(w.lastUpdated)}</div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--text-muted)', marginTop: 4,
                }}>
                  {w.workspaceId.slice(0, 20)}…
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selected?.workspaceId === w.workspaceId && (
                    <div style={{
                      padding: '4px 10px', borderRadius: 20,
                      background: 'var(--accent-dim)', color: 'var(--accent)',
                      fontSize: 11, fontWeight: 600,
                    }}>
                      Active
                    </div>
                  )}
                  <button
                    onClick={(e) => copyWorkspaceId(w.workspaceId, e)}
                    style={{
                      fontSize: 10, padding: '3px 9px', borderRadius: 20,
                      background: copiedId === w.workspaceId ? 'rgba(16,185,129,0.12)' : 'var(--bg-hover)',
                      color: copiedId === w.workspaceId ? 'var(--accent-success)' : 'var(--text-muted)',
                      border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {copiedId === w.workspaceId ? '✓ Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

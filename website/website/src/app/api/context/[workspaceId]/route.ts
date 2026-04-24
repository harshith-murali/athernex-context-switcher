import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';

const SNIPPET = 500;

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { workspaceId } = await params;
    const workspace = await Workspace.findOne({ workspaceId, userId }).lean() as any;

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Sort browser tabs by recency, top 3
    const topBrowser = [...(workspace.browserState ?? [])]
      .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
      .slice(0, 3)
      .map((t: any) => ({
        title:   t.title,
        url:     t.url,
        snippet: truncate(t.content, SNIPPET),
      }));

    // Sort code files by recency
    const sortedCode = [...(workspace.codeState ?? [])]
      .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    const activeFile = sortedCode[0]
      ? {
          path:     sortedCode[0].path,
          language: sortedCode[0].language,
          snippet:  truncate(sortedCode[0].content, SNIPPET),
        }
      : null;

    const relatedFiles = sortedCode.slice(1, 3).map((f: any) => ({
      path:     f.path,
      language: f.language,
      snippet:  truncate(f.content, SNIPPET),
    }));

    return NextResponse.json({
      code:        { activeFile, relatedFiles },
      browser:     topBrowser,
      chatSummary: workspace.chats?.rollingSummary ?? null,
    });
  } catch (err: any) {
    console.error('❌ /api/context/[workspaceId] error:', err);
    return NextResponse.json({ error: 'Failed to fetch context', details: err.message }, { status: 500 });
  }
}

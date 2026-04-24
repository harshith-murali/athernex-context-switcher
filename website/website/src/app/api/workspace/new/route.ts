import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB, Workspace } from '@/lib/db';

export async function POST(req: Request) {

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json().catch(() => ({}));
    const name = body?.name?.trim() || 'Unnamed Workspace';

    const workspaceId = uuidv4();
    const workspace = new Workspace({
      workspaceId,
      userId,
      name,
      browserState: [],
      codeState:    [],
      chats: { messages: [], rollingSummary: {}, lastSummarizedIndex: 0 },
      lastUpdated: Date.now(),
    });

    await workspace.save();
    return NextResponse.json({ workspaceId, name: workspace.name });
  } catch (err: any) {
    console.error('❌ /api/workspace/new error:', err);
    return NextResponse.json({ error: 'Failed to create workspace', details: err.message }, { status: 500 });
  }
}

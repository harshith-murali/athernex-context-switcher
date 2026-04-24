import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const hdrs = corsHeaders(origin);
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: hdrs });
    }

    await connectDB();

    const workspaces = await Workspace
      .find({ userId }, { workspaceId: 1, name: 1, lastUpdated: 1 })
      .sort({ lastUpdated: -1 })
      .lean();

    return NextResponse.json({
      userId,
      workspaces: workspaces.map((w: any) => ({
        workspaceId: w.workspaceId,
        name:        w.name,
        lastUpdated: w.lastUpdated,
      }))
    }, { headers: hdrs });
  } catch (err: any) {
    console.error('❌ /api/context list error:', err);
    return NextResponse.json({ error: 'Failed to list workspaces', details: err.message }, { status: 500, headers: hdrs });
  }
}


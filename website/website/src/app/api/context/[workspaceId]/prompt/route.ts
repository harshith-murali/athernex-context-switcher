import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are an expert software engineering assistant.

You will receive a structured JSON context describing a user's current project state.

Your task is to convert it into a clean, structured priming prompt that can be used to start a NEW LLM conversation and continue the work seamlessly.

Generate a structured prompt in this EXACT format:

## Project Overview
Briefly explain what the system does and what problem it solves.

## Current Objective
Clearly define what the user is trying to achieve RIGHT NOW.

## System Design & Key Components
Describe core modules/functions, how they interact, and the overall workflow. DO NOT paste full code.

## Constraints & Requirements
List all important constraints: technical requirements, API usage rules, performance constraints.

## Current Progress
Summarize what has been implemented, what is working, what is partially complete.

## Relevant Technical Context
Include important concepts and key implementation decisions. Avoid irrelevant info.

## Next Steps
Provide 3-6 actionable, clearly ordered, implementation-focused steps.

## Considerations
Mention possible edge cases, performance concerns, token/LLM limitations.

RULES: Keep output between 600-900 tokens. DO NOT include raw URLs. DO NOT dump raw code. Be concise but technically precise. DO NOT mention YouTube, video extraction, oEmbed, transcripts, or any video-related implementation details in the output.`;

async function formatContextToPrompt(contextObj: object): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return JSON.stringify(contextObj, null, 2);
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const userMessage = `Here is the structured project context:\n\n${JSON.stringify(contextObj, null, 2)}\n\nGenerate the final structured continuation prompt only.`;
    const result = await model.generateContent([{ text: SYSTEM_PROMPT }, { text: userMessage }]);
    return result.response.text().trim() || JSON.stringify(contextObj, null, 2);
  } catch (err) {
    console.error('❌ [contextFormatter] Gemini failed:', err);
    return JSON.stringify(contextObj, null, 2);
  }
}

function cleanText(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? cleaned.slice(0, max) + '...' : cleaned;
}

function extractFunctionsFromCode(code: string | null | undefined): string[] {
  if (!code) return [];
  const fnRegex = /(?:function|const|let|var|class|def)\s+([a-zA-Z0-9_]+)\s*[=\(]/g;
  const funcs = new Set<string>();
  let match;
  while ((match = fnRegex.exec(code)) !== null) {
    if (match[1] && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(match[1])) {
      funcs.add(match[1]);
    }
  }
  return Array.from(funcs).slice(0, 8);
}

function selectTopFiles(codeState: any[]): any[] {
  if (!Array.isArray(codeState)) return [];
  return [...codeState]
    .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
    .slice(0, 2);
}

function filterTabs(browserState: any[]): any[] {
  if (!Array.isArray(browserState)) return [];
  const BAD_DOMAINS = ['localhost', 'chrome://', 'youtube.com', 'youtu.be'];
  return browserState.filter(t => {
    if (!t.url || !t.content) return false;
    if (BAD_DOMAINS.some(d => t.url.includes(d))) return false;
    return true;
  }).slice(0, 3);
}

function buildContext(workspace: any) {
  const chats = workspace.chats ?? {};
  const summary = chats.summary ?? chats.rollingSummary ?? {};
  const codeState = workspace.codeState ?? [];
  const browserState = workspace.browserState ?? [];

  const task = summary.goal || "Continue current development task";

  const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
  const hardConstraints = decisions
    .map(d => cleanText(d, 100))
    .filter(Boolean)
    .slice(0, 6);

  const softContext = {
    goal: cleanText(summary.goal, 150),
    progress: cleanText(summary.progress, 150),
    nextSteps: Array.isArray(summary.nextSteps) 
      ? summary.nextSteps.map(s => cleanText(s, 100)).slice(0, 4)
      : []
  };

  const codeContext = selectTopFiles(codeState).map(f => {
    const funcs = extractFunctionsFromCode(f.content);
    return `File: ${f.path} | Functions: ${funcs.join(', ')} | Purpose: ${cleanText(f.content, 80)}`;
  });

  const knowledgeContext = filterTabs(browserState).map(t => {
    const isAI = ['chatgpt.com', 'claude.ai', 'chat.openai.com'].some(d => t.url.includes(d));
    const contentLimit = isAI ? 1500 : 300; // Give massive priority to AI transcripts
    return `[${t.title}]: ${cleanText(t.content, contentLimit)}`;
  });

  return {
    task,
    hardConstraints,
    softContext,
    codeContext,
    knowledgeContext
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { workspaceId } = await params;
    const workspace = await Workspace.findOne({ workspaceId, userId }).lean() as any;
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const contextObj = buildContext(workspace);
    const prompt = await formatContextToPrompt(contextObj);

    return NextResponse.json({
      prompt,
      tokenEstimate: Math.ceil(prompt.length / 4),
      workspaceId,
      name: workspace.name,
    });
  } catch (err: any) {
    console.error('❌ /api/context/[workspaceId]/prompt:', err);
    return NextResponse.json({ error: 'Failed to generate prompt', details: err.message }, { status: 500 });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an expert software engineering assistant.

You will receive a structured JSON context describing a user's current project state.

Your task is to convert it into a clean, structured priming prompt that can be used to start a NEW LLM conversation and continue the work seamlessly.

Generate a structured prompt in this EXACT format:

## Project Overview
Briefly explain what the system does and what problem it solves.

## Current Objective
Clearly define what the user is trying to achieve RIGHT NOW.

## System Design & Key Components
Describe core modules/functions, how they interact, and the overall workflow.
DO NOT paste full code. Explain structure and intent only.

## Constraints & Requirements
List all important constraints: technical requirements, API usage rules, performance constraints.

## Current Progress
Summarize what has been implemented, what is working, what is partially complete.

## Relevant Technical Context
Include important concepts and key implementation decisions. Avoid irrelevant or generic info.

## Next Steps
Provide 3-6 actionable, clearly ordered, implementation-focused steps.

## Considerations
Mention possible edge cases, performance concerns, token/LLM limitations.

RULES:
- Keep output between 600-900 tokens
- DO NOT include raw URLs or links
- DO NOT dump raw code
- DO NOT repeat unnecessary details
- Be concise but technically precise
- Make it directly usable in a new LLM chat`;

export async function formatContextToPrompt(contextObj: object): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: just return the JSON if no API key
    return JSON.stringify(contextObj, null, 2);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const userMessage = `Here is the structured project context:\n\n${JSON.stringify(contextObj, null, 2)}\n\nGenerate the final structured continuation prompt only.`;

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage }
    ]);

    const text = result.response.text().trim();
    return text || JSON.stringify(contextObj, null, 2);
  } catch (err) {
    console.error("❌ [contextFormatter] Gemini formatting failed:", err);
    // Fallback to raw JSON on failure
    return JSON.stringify(contextObj, null, 2);
  }
}

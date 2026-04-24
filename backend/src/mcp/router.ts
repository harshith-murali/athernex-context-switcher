import { youtubeExtract } from "./youtube.js";
import { githubExtract } from "./github.js";
import { notionExtract } from "./notion.js";
import { gdocsExtract } from "./gdocs.js";

export interface StructuredContent {
  source: "youtube" | "github" | "notion" | "gdocs";
  title: string;
  metadata: Record<string, unknown>;
  content: string;
}

export async function getStructuredContent(url: string): Promise<StructuredContent | null> {
  try {
    if (url.includes("youtube.com")) {
      return await youtubeExtract(url);
    }
    if (url.includes("github.com")) {
      return await githubExtract(url);
    }
    if (url.includes("notion.com")) {
      return await notionExtract(url);
    }
    if (url.includes("docs.google.com")) {
      return await gdocsExtract(url);
    }
  } catch (err) {
    console.error(`MCP extraction failed for ${url}:`, err);
  }
  return null;
}

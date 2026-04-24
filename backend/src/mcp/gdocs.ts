import { StructuredContent } from "./router.ts";

export async function gdocsExtract(url: string): Promise<StructuredContent> {
  // TODO: Real implementation: use Google Docs API
  return {
    source: "gdocs",
    title: `Google Doc: ${url.split("/").pop()?.slice(0, 20)}`,
    metadata: { url },
    content: `[Google Doc from ${url} - content extraction pending]`
  };
}

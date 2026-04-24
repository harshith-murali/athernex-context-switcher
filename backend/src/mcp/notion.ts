import { StructuredContent } from "./router.ts";

export async function notionExtract(url: string): Promise<StructuredContent> {
  // TODO: Real implementation: use Notion API
  return {
    source: "notion",
    title: `Notion: ${url.split("/").pop()?.slice(0, 20)}`,
    metadata: { url },
    content: `[Notion page from ${url} - content extraction pending]`
  };
}

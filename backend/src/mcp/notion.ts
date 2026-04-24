import { StructuredContent } from "./router.js";

export async function notionExtract(url: string): Promise<StructuredContent> {
  try {
    const pageId = extractNotionPageId(url);
    if (!pageId) {
      throw new Error("Invalid Notion URL");
    }

    const title = extractTitleFromUrl(url);
    const content = await fetchNotionPageContent(pageId);

    return {
      source: "notion",
      title: `Notion: ${title}`,
      metadata: { url, pageId },
      content: content || "[Notion page - public access required for content extraction]"
    };
  } catch (error) {
    return {
      source: "notion",
      title: `Notion: ${extractTitleFromUrl(url)}`,
      metadata: { url, error: String(error) },
      content: `[Note: Notion content extraction requires page to be publicly shared. Error: ${String(error)}]`
    };
  }
}

function extractNotionPageId(url: string): string | null {
  // Notion URLs: https://www.notion.so/page-title-<id> or https://notion.so/<id>
  const match = url.match(/(?:notion\.so\/)?([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  return match ? match[1].replace(/-/g, "") : null;
}

function extractTitleFromUrl(url: string): string {
  const parts = url.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart
    .split("-")
    .slice(0, -1)
    .join(" ")
    .slice(0, 50) || "Page";
}

async function fetchNotionPageContent(pageId: string): Promise<string> {
  try {
    const formattedId = `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`;
    const response = await fetch(
      `https://notion.so/api/v3/loadPageChunk?pageId=${formattedId}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Notion page");
    }

    // Note: Notion API requires authentication for full content
    // This is a simplified extraction
    return "[Notion page content - requires authenticated API access]";
  } catch (error) {
    throw error;
  }
}

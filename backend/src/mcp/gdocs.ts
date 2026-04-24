import { StructuredContent } from "./router.js";

export async function gdocsExtract(url: string): Promise<StructuredContent> {
  try {
    const docId = extractDocId(url);
    if (!docId) {
      throw new Error("Invalid Google Docs URL");
    }

    const content = await fetchGoogleDocContent(docId);
    const title = extractTitleFromUrl(url);

    return {
      source: "gdocs",
      title: `Google Docs: ${title}`,
      metadata: { url, docId },
      content: content || "[Google Doc - content extraction requires authenticated access]"
    };
  } catch (error) {
    return {
      source: "gdocs",
      title: `Google Docs: ${extractTitleFromUrl(url)}`,
      metadata: { url, error: String(error) },
      content: `[Google Docs: Public access required. Error: ${String(error)}]`
    };
  }
}

function extractDocId(url: string): string | null {
  // Google Docs URLs: https://docs.google.com/document/d/<id>/edit
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function extractTitleFromUrl(url: string): string {
  // Try to get title from URL if available
  const match = url.match(/[#&]?title=([^&]+)/);
  if (match) return decodeURIComponent(match[1]);
  return "Document";
}

async function fetchGoogleDocContent(docId: string): Promise<string> {
  try {
    // Export as plain text (works for publicly shared docs)
    const response = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=txt`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Google Docs");
    }

    const text = await response.text();
    return text.slice(0, 5000); // Limit to 5000 chars
  } catch (error) {
    throw error;
  }
}

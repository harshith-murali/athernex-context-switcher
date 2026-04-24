import { StructuredContent } from "./router.js";

export async function youtubeExtract(url: string): Promise<StructuredContent> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const transcript = await fetchTranscript(videoId);
    const title = await getVideoTitle(videoId);

    return {
      source: "youtube",
      title: `YouTube: ${title}`,
      metadata: { url, videoId },
      content: transcript
    };
  } catch (error) {
    return {
      source: "youtube",
      title: `YouTube: ${url.split("/").pop()}`,
      metadata: { url, error: String(error) },
      content: `[Error fetching transcript: ${String(error)}]`
    };
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
  const response = await fetch(
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.statusText}`);
  }

  const xml = await response.text();
  return parseTranscriptXml(xml);
}

function parseTranscriptXml(xml: string): string {
  const textRegex = /<text start="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  const lines: string[] = [];
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const timestamp = formatTimestamp(parseFloat(match[1]));
    const text = decodeHtml(match[2]);
    if (text.trim()) {
      lines.push(`[${timestamp}] ${text}`);
    }
  }

  return lines.join("\n");
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " "
  };

  return text.replace(/&[^;]+;/g, (match) => entities[match] || match);
}

async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
    );
    if (response.ok) {
      const data = await response.json();
      return data.title;
    }
  } catch {
    // Fallback if oEmbed fails
  }
  return videoId;
}
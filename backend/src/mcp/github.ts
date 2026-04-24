import { StructuredContent } from "./router.js";

export async function githubExtract(url: string): Promise<StructuredContent> {
  try {
    const { owner, repo, type, number } = parseGithubUrl(url);

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL");
    }

    let content = "";
    let title = `GitHub: ${owner}/${repo}`;

    if ((type === "issue" || type === "pull") && number) {
      const data = await fetchGithubIssueOrPR(owner, repo, number, type);
      title = `GitHub ${type === "pull" ? "PR" : "Issue"}: ${data.title}`;
      content = formatIssueContent(data);
    } else {
      const data = await fetchGithubRepo(owner, repo);
      title = `GitHub Repo: ${data.full_name}`;
      content = formatRepoContent(data);
    }

    return {
      source: "github",
      title,
      metadata: { url, owner, repo, type },
      content
    };
  } catch (error) {
    return {
      source: "github",
      title: `GitHub: ${url.split("/").slice(-2).join("/")}`,
      metadata: { url, error: String(error) },
      content: `[Error fetching GitHub content: ${String(error)}]`
    };
  }
}

function parseGithubUrl(url: string): {
  owner?: string;
  repo?: string;
  type?: string;
  number?: number;
} {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+)\/(?:pull|issues)\/(\d+)/,
    /github\.com\/([^/]+)\/([^/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        type: url.includes("pull") ? "pull" : url.includes("issues") ? "issue" : "repo",
        number: match[3] ? parseInt(match[3]) : undefined
      };
    }
  }

  return {};
}

async function fetchGithubRepo(owner: string, repo: string): Promise<any> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

async function fetchGithubIssueOrPR(
  owner: string,
  repo: string,
  number: number,
  type: string
): Promise<any> {
  const endpoint = type === "pull" ? "pulls" : "issues";
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${number}`
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

function formatRepoContent(repo: any): string {
  return `
Repository: ${repo.full_name}
Description: ${repo.description || "No description"}
Stars: ${repo.stargazers_count}
Language: ${repo.language || "N/A"}
Topics: ${repo.topics?.join(", ") || "None"}
${repo.readme_content || ""}
`.trim();
}

function formatIssueContent(issue: any): string {
  return `
Title: ${issue.title}
State: ${issue.state}
Author: ${issue.user.login}
Created: ${issue.created_at}
Updated: ${issue.updated_at}

${issue.body || "No description"}

Comments: ${issue.comments}
`.trim();
}

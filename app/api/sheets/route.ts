import { NextResponse } from "next/server";

export async function GET() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    return NextResponse.json({});
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/sheets.json`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return NextResponse.json({});
    const file = await res.json();
    const content = JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
    return NextResponse.json(content);
  } catch {
    return NextResponse.json({});
  }
}

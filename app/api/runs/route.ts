import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId가 필요합니다." }, { status: 400 });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    return NextResponse.json({ error: "GitHub 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "실행 상태 조회 실패" }, { status: 502 });
  }

  const data = await res.json();
  const conclusion = data.conclusion;
  const status = data.status;

  let mappedStatus: string;
  if (status === "completed") {
    mappedStatus = conclusion === "success" ? "completed" : "failure";
  } else {
    mappedStatus = status;
  }

  const sheetUrl = await getSheetUrl(owner, repo, token, data.head_sha);

  return NextResponse.json({
    status: mappedStatus,
    conclusion,
    runUrl: data.html_url,
    sheetUrl,
  });
}

async function getSheetUrl(owner: string, repo: string, token: string, _sha: string): Promise<string | null> {
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
    if (!res.ok) return null;
    const file = await res.json();
    const content = JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
    return content ?? null;
  } catch {
    return null;
  }
}

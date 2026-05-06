import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { gameSlug, boardId, boardName } = await req.json();

  if (!gameSlug || !boardId) {
    return NextResponse.json({ error: "gameSlug, boardId는 필수입니다." }, { status: 400 });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    return NextResponse.json({ error: "GitHub 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { game_slug: gameSlug, board_id: String(boardId), board_name: boardName ?? "" },
      }),
    }
  );

  if (!dispatchRes.ok) {
    const text = await dispatchRes.text();
    return NextResponse.json({ error: `GitHub API 오류: ${text}` }, { status: 502 });
  }

  await new Promise((r) => setTimeout(r, 3000));

  const runsRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!runsRes.ok) {
    return NextResponse.json({ error: "워크플로우 실행 ID 조회 실패" }, { status: 502 });
  }

  const runsData = await runsRes.json();
  const latestRun = runsData.workflow_runs?.[0];

  return NextResponse.json({
    runId: latestRun?.id,
    runUrl: latestRun?.html_url,
  });
}

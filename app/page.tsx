"use client";

import { useState, useEffect } from "react";
import { GAMES, type Game, type Board } from "@/lib/boards";
import { useRouter } from "next/navigation";

type RunStatus = "idle" | "triggering" | "queued" | "in_progress" | "completed" | "failure";

interface RunInfo {
  status: RunStatus;
  runId?: number;
  runUrl?: string;
  sheetUrl?: string;
  message?: string;
}

const GAME_EMOJI: Record<string, string> = {
  "maplestoryidle-kr": "🍁",
  "azurpromilia": "⚓",
  "bluearchive": "📘",
  "baramy": "🌬️",
  "fcmobile": "⚽",
  "kartrush": "🏎️",
  "v4kr": "⚔️",
};

export default function Home() {
  const [selectedGame, setSelectedGame] = useState<Game>(GAMES[0]);
  const [selectedBoard, setSelectedBoard] = useState<Board>(GAMES[0].boards[0]);
  const [run, setRun] = useState<RunInfo>({ status: "idle" });
  const [sheetMap, setSheetMap] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => { if (r.status === 401) { router.push("/login"); } return r; })
      .then((r) => r.ok ? r.json() : {})
      .then(setSheetMap)
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!["queued", "in_progress", "triggering"].includes(run.status)) return;
    if (!run.runId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/runs?runId=${run.runId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();

      if (data.status === "completed") {
        const newSheetMap = { ...sheetMap, [selectedGame.slug]: data.sheetUrl };
        setSheetMap(newSheetMap);
        setRun({ status: "completed", runId: run.runId, runUrl: run.runUrl, sheetUrl: data.sheetUrl });
        clearInterval(interval);
      } else if (data.status === "failure") {
        setRun((prev) => ({ ...prev, status: "failure", message: "GitHub Actions 실행 중 오류가 발생했습니다." }));
        clearInterval(interval);
      } else {
        setRun((prev) => ({ ...prev, status: data.status }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [run.status, run.runId, router, selectedGame.slug, sheetMap]);

  const handleGameChange = (slug: string) => {
    const game = GAMES.find((g) => g.slug === slug)!;
    setSelectedGame(game);
    setSelectedBoard(game.boards[0]);
    setRun({ status: "idle" });
  };

  const handleScrape = async () => {
    setRun({ status: "triggering" });

    const res = await fetch("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameSlug: selectedGame.slug,
        boardId: selectedBoard.id,
        boardName: selectedBoard.name,
      }),
    });

    if (res.status === 401) { router.push("/login"); return; }

    const data = await res.json();
    if (!res.ok) {
      setRun({ status: "failure", message: data.error });
      return;
    }

    setRun({ status: "queued", runId: data.runId, runUrl: data.runUrl });
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const isRunning = ["triggering", "queued", "in_progress"].includes(run.status);
  const currentSheetUrl = sheetMap[selectedGame.slug];

  const statusBadge = () => {
    if (run.status === "idle") return null;
    const configs = {
      triggering: { label: "요청 중...", bg: "#FEF9C3", border: "#FDE047", color: "#854D0E" },
      queued:     { label: "대기 중",   bg: "#FEF9C3", border: "#FDE047", color: "#854D0E" },
      in_progress:{ label: "실행 중",   bg: "#DBEAFE", border: "#93C5FD", color: "#1E40AF" },
      completed:  { label: "완료 ✓",   bg: "#D1FAE5", border: "#6EE7B7", color: "#065F46" },
      failure:    { label: "실패 ✗",   bg: "#FEE2E2", border: "#FCA5A5", color: "#991B1B" },
    };
    const cfg = configs[run.status as keyof typeof configs];
    return (
      <span
        className="text-xs font-black px-3 py-1 rounded-full"
        style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, color: cfg.color }}
      >
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white" style={{ borderBottom: "2px solid #1A1A1A" }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="logo" className="w-7 h-7" style={{ borderRadius: 6 }} />
            <span className="font-black text-base" style={{ color: "#1A1A1A" }}>넥슨 포럼 스크래퍼</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs hover:opacity-60 transition-opacity"
            style={{ color: "#B0B0B0", fontWeight: 500 }}
          >
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {/* ── 게임 선택 ──────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>
            STEP 1 — 게임 선택
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {GAMES.map((game) => {
              const active = selectedGame.slug === game.slug;
              return (
                <button
                  key={game.slug}
                  onClick={() => handleGameChange(game.slug)}
                  className="text-left px-4 py-3 transition-all"
                  style={{
                    background: active ? "#1A1A1A" : "#FFFFFF",
                    border: "2px solid #1A1A1A",
                    borderRadius: 12,
                    boxShadow: active ? "none" : "2px 2px 0px 0px #1A1A1A",
                    transform: active ? "translate(2px, 2px)" : undefined,
                    color: active ? "#FFFFFF" : "#1A1A1A",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <span className="block text-lg mb-0.5">{GAME_EMOJI[game.slug] ?? "🎮"}</span>
                  {game.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 게시판 + 실행 ──────────────────────────────────────────── */}
        <section
          style={{
            background: "#FFFFFF",
            border: "2px solid #1A1A1A",
            borderRadius: 16,
            boxShadow: "4px 4px 0px 0px #1A1A1A",
            padding: "24px",
          }}
        >
          <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "#9CA3AF" }}>
            STEP 2 — 게시판 선택 후 스크래핑
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedBoard.id}
              onChange={(e) => {
                const board = selectedGame.boards.find((b) => b.id === Number(e.target.value))!;
                setSelectedBoard(board);
                setRun({ status: "idle" });
              }}
              className="flex-1"
              style={{
                background: "#FAFAFA",
                border: "2px solid #1A1A1A",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: "#1A1A1A",
                boxShadow: "2px 2px 0px 0px #1A1A1A",
                cursor: "pointer",
              }}
            >
              {selectedGame.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleScrape}
              disabled={isRunning}
              className="neo-button px-6 py-2.5 text-sm flex-shrink-0"
              style={{ background: isRunning ? "#F0EFEC" : "#00C73C", color: isRunning ? "#9CA3AF" : "#FFFFFF" }}
            >
              {isRunning ? "실행 중..." : "🚀 스크래핑 시작"}
            </button>

            {currentSheetUrl && (
              <a
                href={currentSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="neo-button px-5 py-2.5 text-sm flex-shrink-0"
                style={{ background: "#FFFFFF", color: "#1A1A1A" }}
              >
                📊 시트 열기
              </a>
            )}
          </div>
        </section>

        {/* ── 실행 상태 ──────────────────────────────────────────────── */}
        {run.status !== "idle" && (
          <section
            style={{
              background: "#FFFFFF",
              border: "2px solid #1A1A1A",
              borderRadius: 16,
              boxShadow: "4px 4px 0px 0px #1A1A1A",
              padding: "24px",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-sm" style={{ color: "#1A1A1A" }}>실행 상태</p>
              {statusBadge()}
            </div>

            {isRunning && (
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                  style={{ borderColor: "#1A1A1A", borderTopColor: "transparent" }}
                />
                <p className="text-sm" style={{ color: "#4A4A4A" }}>
                  GitHub Actions에서 스크래핑 중입니다. 완료까지 수 분이 소요될 수 있습니다.
                </p>
              </div>
            )}

            {run.status === "completed" && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{ background: "#F0FDF4", border: "2px solid #6EE7B7" }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: "#065F46" }}>
                  ✓ 스크래핑 완료! 신규 게시글이 시트에 추가되었습니다.
                </p>
                {run.sheetUrl && (
                  <a href={run.sheetUrl} target="_blank" rel="noreferrer"
                    className="text-xs font-bold underline" style={{ color: "#059669" }}>
                    → Google Sheets 바로가기
                  </a>
                )}
              </div>
            )}

            {run.status === "failure" && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{ background: "#FFF5F5", border: "2px solid #FCA5A5" }}
              >
                <p className="font-bold text-sm" style={{ color: "#991B1B" }}>
                  ✗ {run.message ?? "오류가 발생했습니다."}
                </p>
              </div>
            )}

            {run.runUrl && (
              <a href={run.runUrl} target="_blank" rel="noreferrer"
                className="text-xs hover:underline" style={{ color: "#9CA3AF" }}>
                GitHub Actions 로그 확인 →
              </a>
            )}
          </section>
        )}

        {/* ── 수집 게임 시트 목록 ──────────────────────────────────── */}
        {Object.keys(sheetMap).length > 0 && (
          <section>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>
              수집된 포럼 시트
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(sheetMap).map(([slug, url]) => {
                const game = GAMES.find((g) => g.slug === slug);
                return (
                  <a
                    key={slug}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="card-hover flex items-center gap-3 px-4 py-3"
                  >
                    <span className="text-xl">{GAME_EMOJI[slug] ?? "🎮"}</span>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{game?.name ?? slug}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>Google Sheets 열기 ↗</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <footer className="text-center text-xs pb-8" style={{ color: "#D1D5DB" }}>
          이미 수집된 게시글은 자동으로 건너뜁니다
        </footer>
      </main>
    </div>
  );
}

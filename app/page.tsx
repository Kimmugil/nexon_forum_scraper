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


export default function Home() {
  const [selectedGame, setSelectedGame] = useState<Game>(GAMES[0]);
  const [selectedBoard, setSelectedBoard] = useState<Board>(GAMES[0].boards[0]);
  const [run, setRun] = useState<RunInfo>({ status: "idle" });
  const [sheetMap, setSheetMap] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => { if (r.status === 401) router.push("/login"); return r; })
      .then((r) => r.ok ? r.json() : {})
      .then(setSheetMap).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!["queued", "in_progress", "triggering"].includes(run.status) || !run.runId) return;
    const iv = setInterval(async () => {
      const res = await fetch(`/api/runs?runId=${run.runId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.status === "completed") {
        setSheetMap((m) => ({ ...m, [selectedGame.slug]: data.sheetUrl }));
        setRun({ status: "completed", runId: run.runId, runUrl: run.runUrl, sheetUrl: data.sheetUrl });
        clearInterval(iv);
      } else if (data.status === "failure") {
        setRun((p) => ({ ...p, status: "failure", message: "GitHub Actions 실행 중 오류가 발생했습니다." }));
        clearInterval(iv);
      } else {
        setRun((p) => ({ ...p, status: data.status }));
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [run.status, run.runId, router, selectedGame.slug]);

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
      body: JSON.stringify({ gameSlug: selectedGame.slug, boardId: selectedBoard.id, boardName: selectedBoard.name }),
    });
    if (res.status === 401) { router.push("/login"); return; }
    const data = await res.json();
    if (!res.ok) { setRun({ status: "failure", message: data.error }); return; }
    setRun({ status: "queued", runId: data.runId, runUrl: data.runUrl });
  };

  const isRunning = ["triggering", "queued", "in_progress"].includes(run.status);

  const StatusBadge = () => {
    const cfgs = {
      triggering:  { label: "요청 중...", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
      queued:      { label: "대기 중",    cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
      in_progress: { label: "실행 중",    cls: "bg-blue-50 text-blue-700 border border-blue-200" },
      completed:   { label: "완료",       cls: "bg-green-50 text-green-700 border border-green-200" },
      failure:     { label: "실패",       cls: "bg-red-50 text-red-700 border border-red-200" },
    };
    if (run.status === "idle") return null;
    const c = cfgs[run.status as keyof typeof cfgs];
    return (
      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${c.cls}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-gray-900 text-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-sm font-semibold">넥슨 포럼 스크래퍼</span>
          </div>
          <button
            onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/login"); }}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Step 1 — 게임 선택 */}
        <section>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Step 1 — 게임 선택</p>
          <div className="grid grid-cols-2 gap-2">
            {GAMES.map((game) => (
              <button
                key={game.slug}
                onClick={() => handleGameChange(game.slug)}
                className={`text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  selectedGame.slug === game.slug
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {game.name}
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 — 게시판 선택 + 스크래핑 */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Step 2 — 게시판 선택 후 스크래핑</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={selectedBoard.id}
              onChange={(e) => {
                setSelectedBoard(selectedGame.boards.find((b) => b.id === Number(e.target.value))!);
                setRun({ status: "idle" });
              }}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
            >
              {selectedGame.boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={handleScrape}
              disabled={isRunning}
              className={`shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-colors shadow-sm ${
                isRunning
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-green-500 text-white hover:bg-green-600 shadow-green-200"
              }`}
            >
              {isRunning ? "실행 중..." : "스크래핑 시작"}
            </button>
            {sheetMap[selectedGame.slug] && (
              <a
                href={sheetMap[selectedGame.slug]}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 px-5 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors"
              >
                시트 열기
              </a>
            )}
          </div>
        </section>

        {/* 실행 상태 */}
        {run.status !== "idle" && (
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">실행 상태</span>
              <StatusBadge />
            </div>

            {isRunning && (
              <div className="flex items-center gap-3 mb-3">
                <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-700 inline-block animate-spin shrink-0" />
                <span className="text-sm text-gray-500">GitHub Actions에서 스크래핑 중입니다. 수 분 소요될 수 있습니다.</span>
              </div>
            )}

            {run.status === "completed" && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-3">
                <p className="text-sm font-medium text-green-700">스크래핑 완료! 신규 게시글이 시트에 추가되었습니다.</p>
                {run.sheetUrl && (
                  <a href={run.sheetUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline mt-1 inline-block">
                    → Google Sheets 바로가기
                  </a>
                )}
              </div>
            )}

            {run.status === "failure" && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-3">
                <p className="text-sm font-medium text-red-700">{run.message ?? "오류가 발생했습니다."}</p>
              </div>
            )}

            {run.runUrl && (
              <a href={run.runUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                GitHub Actions 로그 확인 →
              </a>
            )}
          </section>
        )}

        {/* 수집된 시트 목록 */}
        {Object.keys(sheetMap).length > 0 && (
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">수집된 포럼 시트</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(sheetMap).map(([slug, url]) => (
                <a
                  key={slug}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{GAMES.find((g) => g.slug === slug)?.name ?? slug}</p>
                    <p className="text-xs text-gray-400">Google Sheets 열기</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-gray-300 pt-2">이미 수집된 게시글은 자동으로 건너뜁니다</p>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

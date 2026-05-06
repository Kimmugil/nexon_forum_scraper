"use client";

import { useState, useEffect } from "react";
import { GAMES, type Game, type Board } from "@/lib/boards";

type RunStatus = "idle" | "triggering" | "queued" | "in_progress" | "completed" | "failure";

interface RunInfo {
  status: RunStatus;
  runId?: number;
  runUrl?: string;
  sheetUrl?: string;
  message?: string;
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "",
  triggering: "요청 중...",
  queued: "대기 중",
  in_progress: "실행 중",
  completed: "완료",
  failure: "실패",
};

const STATUS_COLOR: Record<RunStatus, string> = {
  idle: "",
  triggering: "text-yellow-400",
  queued: "text-yellow-400",
  in_progress: "text-blue-400",
  completed: "text-green-400",
  failure: "text-red-400",
};

export default function Home() {
  const [selectedGame, setSelectedGame] = useState<Game>(GAMES[0]);
  const [selectedBoard, setSelectedBoard] = useState<Board>(GAMES[0].boards[0]);
  const [run, setRun] = useState<RunInfo>({ status: "idle" });
  const [sheetMap, setSheetMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => r.json())
      .then(setSheetMap)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (run.status === "idle" || run.status === "completed" || run.status === "failure") return;
    if (!run.runId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/runs?runId=${run.runId}`);
      const data = await res.json();

      if (data.status === "completed") {
        const newSheetMap = { ...sheetMap, [selectedGame.slug]: data.sheetUrl };
        setSheetMap(newSheetMap);
        setRun({ status: "completed", runId: run.runId, runUrl: run.runUrl, sheetUrl: data.sheetUrl });
        clearInterval(interval);
      } else if (data.status === "failure") {
        setRun((prev) => ({ ...prev, status: "failure", message: data.message }));
        clearInterval(interval);
      } else {
        setRun((prev) => ({ ...prev, status: data.status }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [run.status, run.runId]);

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

    const data = await res.json();

    if (!res.ok) {
      setRun({ status: "failure", message: data.error });
      return;
    }

    setRun({ status: "queued", runId: data.runId, runUrl: data.runUrl });
  };

  const isRunning = ["triggering", "queued", "in_progress"].includes(run.status);
  const currentSheetUrl = sheetMap[selectedGame.slug];

  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">넥슨 포럼 스크래퍼</h1>
        <p className="text-gray-400 text-sm">게임 포럼을 선택하고 게시판을 골라 Google Sheets로 수집하세요.</p>
      </header>

      <section className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
        <div className="space-y-2">
          <label className="text-sm text-gray-400 font-medium">게임</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GAMES.map((game) => (
              <button
                key={game.slug}
                onClick={() => handleGameChange(game.slug)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                  selectedGame.slug === game.slug
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
                }`}
              >
                {game.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400 font-medium" htmlFor="board-select">
            게시판
          </label>
          <select
            id="board-select"
            value={selectedBoard.id}
            onChange={(e) => {
              const board = selectedGame.boards.find((b) => b.id === Number(e.target.value))!;
              setSelectedBoard(board);
              setRun({ status: "idle" });
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {selectedGame.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleScrape}
            disabled={isRunning}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {isRunning ? "실행 중..." : "스크래핑 시작"}
          </button>

          {currentSheetUrl && (
            <a
              href={currentSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-lg border border-green-700 text-green-400 hover:bg-green-900/30 text-sm font-medium transition-colors whitespace-nowrap"
            >
              시트 열기 ↗
            </a>
          )}
        </div>
      </section>

      {run.status !== "idle" && (
        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">실행 상태</span>
            <span className={`text-sm font-semibold ${STATUS_COLOR[run.status]}`}>
              {STATUS_LABEL[run.status]}
            </span>
          </div>

          {(run.status === "queued" || run.status === "in_progress") && (
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-1/2" />
            </div>
          )}

          {run.status === "completed" && (
            <div className="space-y-2 text-sm text-gray-400">
              <p className="text-green-400">✓ 스크래핑 완료. 신규 게시글이 시트에 추가되었습니다.</p>
              {run.sheetUrl && (
                <a href={run.sheetUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline block">
                  → Google Sheets 바로가기
                </a>
              )}
            </div>
          )}

          {run.status === "failure" && (
            <p className="text-sm text-red-400">✗ {run.message ?? "오류가 발생했습니다."}</p>
          )}

          {run.runUrl && (
            <a
              href={run.runUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              GitHub Actions 로그 보기 →
            </a>
          )}
        </section>
      )}

      <footer className="text-center text-xs text-gray-600">
        수집된 데이터는 게임별 Google Sheets에 저장됩니다. 이미 수집된 게시글은 건너뜁니다.
      </footer>
    </main>
  );
}

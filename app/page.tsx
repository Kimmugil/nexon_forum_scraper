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

const S = {
  page:    { minHeight: "100vh", background: "#FAFAFA", fontFamily: "inherit" } as React.CSSProperties,
  nav:     { position: "sticky" as const, top: 0, zIndex: 50, background: "#fff", borderBottom: "2px solid #1A1A1A" },
  navInner:{ maxWidth: 720, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" },
  navLeft: { display: "flex", alignItems: "center", gap: 8 },
  navTitle:{ fontWeight: 900, fontSize: 15, color: "#1A1A1A" },
  main:    { maxWidth: 720, margin: "0 auto", padding: "40px 20px 60px" },
  label:   { fontSize: 11, fontWeight: 900, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 },
  card:    { background: "#fff", border: "2px solid #1A1A1A", borderRadius: 14, padding: 24, marginBottom: 24 },
  gameGrid:{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 } as React.CSSProperties,
  gameBtn: (active: boolean): React.CSSProperties => ({
    textAlign: "left",
    padding: "12px 14px",
    background: active ? "#1A1A1A" : "#fff",
    border: "2px solid #1A1A1A",
    borderRadius: 10,
    color: active ? "#fff" : "#1A1A1A",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  }),
  row:     { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const },
  select:  { flex: 1, minWidth: 0, background: "#FAFAFA", border: "2px solid #1A1A1A", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" } as React.CSSProperties,
  btn:     (color: string, text = "#fff"): React.CSSProperties => ({
    flexShrink: 0,
    border: "2px solid #1A1A1A",
    borderRadius: 9999,
    boxShadow: "2px 2px 0 #1A1A1A",
    background: color,
    color: text,
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 20px",
    cursor: "pointer",
    transition: "box-shadow .1s, transform .1s",
    whiteSpace: "nowrap" as const,
  }),
  link:    { fontSize: 12, color: "#9CA3AF", textDecoration: "none" },
  sheetGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 } as React.CSSProperties,
  sheetCard: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: "2px solid #1A1A1A", borderRadius: 12, textDecoration: "none", cursor: "pointer" } as React.CSSProperties,
};

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

  const statusBadge = () => {
    const cfgs = {
      triggering:  { label: "요청 중...", bg: "#FEF9C3", border: "#FDE047", color: "#854D0E" },
      queued:      { label: "대기 중",   bg: "#FEF9C3", border: "#FDE047", color: "#854D0E" },
      in_progress: { label: "실행 중",   bg: "#DBEAFE", border: "#93C5FD", color: "#1E40AF" },
      completed:   { label: "완료 ✓",   bg: "#D1FAE5", border: "#6EE7B7", color: "#065F46" },
      failure:     { label: "실패 ✗",   bg: "#FEE2E2", border: "#FCA5A5", color: "#991B1B" },
    };
    if (run.status === "idle") return null;
    const c = cfgs[run.status as keyof typeof cfgs];
    return (
      <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 12px", borderRadius: 9999, background: c.bg, border: `2px solid ${c.border}`, color: c.color }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <div style={S.navLeft}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }} />
            <span style={S.navTitle}>넥슨 포럼 스크래퍼</span>
          </div>
          <button onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/login"); }}
            style={{ fontSize: 12, color: "#B0B0B0", background: "none", border: "none", cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
      </nav>

      <main style={S.main}>
        {/* Step 1 */}
        <div style={{ marginBottom: 8 }}><span style={S.label}>Step 1 — 게임 선택</span></div>
        <div style={{ ...S.gameGrid, marginBottom: 24 }}>
          {GAMES.map((game) => (
            <button key={game.slug} onClick={() => handleGameChange(game.slug)} style={S.gameBtn(selectedGame.slug === game.slug)}>
              <span style={{ display: "block", fontSize: 18, marginBottom: 2 }}>{GAME_EMOJI[game.slug] ?? "🎮"}</span>
              {game.name}
            </button>
          ))}
        </div>

        {/* Step 2 */}
        <div style={S.card}>
          <div style={{ marginBottom: 16 }}><span style={S.label}>Step 2 — 게시판 선택 후 스크래핑</span></div>
          <div style={S.row}>
            <select value={selectedBoard.id} onChange={(e) => { setSelectedBoard(selectedGame.boards.find((b) => b.id === Number(e.target.value))!); setRun({ status: "idle" }); }} style={S.select}>
              {selectedGame.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={handleScrape} disabled={isRunning} style={S.btn(isRunning ? "#F0EFEC" : "#00C73C", isRunning ? "#9CA3AF" : "#fff")}>
              {isRunning ? "실행 중..." : "🚀 스크래핑 시작"}
            </button>
            {sheetMap[selectedGame.slug] && (
              <a href={sheetMap[selectedGame.slug]} target="_blank" rel="noreferrer" style={{ ...S.btn("#fff", "#1A1A1A"), textDecoration: "none", display: "inline-block" }}>
                📊 시트 열기
              </a>
            )}
          </div>
        </div>

        {/* 실행 상태 */}
        {run.status !== "idle" && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontWeight: 900, fontSize: 14 }}>실행 상태</span>
              {statusBadge()}
            </div>
            {isRunning && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #1A1A1A", borderTopColor: "transparent", display: "inline-block", animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#4A4A4A" }}>GitHub Actions에서 스크래핑 중입니다. 수 분 소요될 수 있습니다.</span>
              </div>
            )}
            {run.status === "completed" && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#F0FDF4", border: "2px solid #6EE7B7", marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: 0 }}>✓ 스크래핑 완료! 신규 게시글이 시트에 추가되었습니다.</p>
                {run.sheetUrl && <a href={run.sheetUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#059669" }}>→ Google Sheets 바로가기</a>}
              </div>
            )}
            {run.status === "failure" && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FFF5F5", border: "2px solid #FCA5A5", marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#991B1B", margin: 0 }}>✗ {run.message ?? "오류가 발생했습니다."}</p>
              </div>
            )}
            {run.runUrl && <a href={run.runUrl} target="_blank" rel="noreferrer" style={S.link}>GitHub Actions 로그 확인 →</a>}
          </div>
        )}

        {/* 수집된 시트 목록 */}
        {Object.keys(sheetMap).length > 0 && (
          <div>
            <div style={{ marginBottom: 10 }}><span style={S.label}>수집된 포럼 시트</span></div>
            <div style={S.sheetGrid}>
              {Object.entries(sheetMap).map(([slug, url]) => (
                <a key={slug} href={url} target="_blank" rel="noreferrer" style={S.sheetCard}>
                  <span style={{ fontSize: 22 }}>{GAME_EMOJI[slug] ?? "🎮"}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1A1A1A", margin: 0 }}>{GAMES.find((g) => g.slug === slug)?.name ?? slug}</p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Google Sheets 열기 ↗</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#D1D5DB", marginTop: 40 }}>이미 수집된 게시글은 자동으로 건너뜁니다</p>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

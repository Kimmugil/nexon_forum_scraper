"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "비밀번호가 올바르지 않습니다.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", padding: "0 16px", fontFamily: "inherit" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#fff", border: "2px solid #1A1A1A", borderRadius: 20, padding: "40px 32px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", margin: "0 auto 12px" }} />
          <h1 style={{ fontWeight: 900, fontSize: 18, color: "#1A1A1A", margin: 0 }}>넥슨 포럼 스크래퍼</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>관리자 비밀번호를 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            style={{ width: "100%", padding: "10px 14px", border: "2px solid #1A1A1A", borderRadius: 10, fontSize: 14, color: "#1A1A1A", background: "#FAFAFA", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
          />

          {error && (
            <p style={{ fontSize: 13, padding: "10px 14px", borderRadius: 10, background: "#FFF5F5", border: "2px solid #FCA5A5", color: "#991B1B", margin: 0 }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{ width: "100%", padding: "12px", border: "2px solid #1A1A1A", borderRadius: 9999, boxShadow: "2px 2px 0 #1A1A1A", background: loading || !password ? "#F0EFEC" : "#00C73C", color: loading || !password ? "#9CA3AF" : "#fff", fontWeight: 800, fontSize: 14, cursor: loading || !password ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

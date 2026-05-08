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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAFA" }}>
      <div
        className="w-full max-w-sm"
        style={{
          background: "#FFFFFF",
          border: "2px solid #1A1A1A",
          borderRadius: 20,
          padding: "40px 32px 32px",
        }}
      >
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="logo" className="w-8 h-8 mx-auto mb-4" style={{ borderRadius: 6 }} />
          <h1 className="font-black text-xl" style={{ color: "#1A1A1A" }}>넥슨 포럼 스크래퍼</h1>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>관리자 비밀번호를 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              className="neo-input"
            />
          </div>

          {error && (
            <p
              className="text-sm px-4 py-2 rounded-xl"
              style={{ background: "#FFF5F5", border: "2px solid #FF6B6B", color: "#C0392B" }}
            >
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="neo-button w-full py-3 text-sm"
            style={{ background: "#00C73C", color: "#FFFFFF" }}
          >
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

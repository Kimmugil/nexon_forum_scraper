import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "넥슨 포럼 스크래퍼",
  description: "넥슨 커뮤니티 포럼 게시글을 Google Sheets로 수집합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}

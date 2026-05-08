import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "넥슨 포럼 스크래퍼",
  description: "넥슨 커뮤니티 포럼 게시글을 Google Sheets로 수집합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${pretendard.className}`}>
      <body className="min-h-screen" style={{ background: "#FAFAFA", fontFamily: pretendard.style.fontFamily }}>
        {children}
      </body>
    </html>
  );
}

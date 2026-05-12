import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星星宠物店",
  description: "内容种草驱动的宠物玩具独立站 MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

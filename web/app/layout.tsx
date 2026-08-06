import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "奶盖和年糕的 AI 成长日记",
  description: "一只傲娇小猫和一只社牛小狗，从陌生到熟悉，一起长大，也一起陪伴“我”的生活。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NofyAI - AI-Powered Algorithmic Trading",
  description: "Universal AI-driven algorithmic trading operating system with multi-agent autonomous trading across cryptocurrency exchanges",
  keywords: ["AI trading", "algorithmic trading", "cryptocurrency", "DeepSeek", "Qwen", "automated trading"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

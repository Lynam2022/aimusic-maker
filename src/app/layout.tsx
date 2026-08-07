import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AiMusic Maker - Modern AI Song & Music Generator | Tạo Nhạc AI Chuyên Nghiệp",
  description: "AiMusic Maker - Create original high-quality songs and music with AI in seconds. Tạo nhạc AI chuyên nghiệp từ lời bài hát hoặc mô tả phong cách.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-[100dvh] overflow-hidden antialiased`}
    >
      <head>
        {/* Theme init: detect dark/light before React hydration to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t||p);}catch(e){}})();`
          }}
        />
      </head>

      <body className="h-[100dvh] overflow-hidden flex flex-col" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

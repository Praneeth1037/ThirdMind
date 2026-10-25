import type { Metadata } from "next";
import "@livekit/components-styles";
import "./globals.css";
import "./homepage.css";
import "./room-layout.css";
import "./theme.css";
export const metadata: Metadata = {
  title: "ThirdMind — Bring the right minds into the conversation.",
  description:
    "Your people. A fresh perspective. Invite AI Minds into your campus group chat and calls. They only speak when you ask.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("thirdmind:theme")==="light"?"light":"dark"}catch{}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

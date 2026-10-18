import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { SearchProvider } from "@/components/search/search-dialog";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
import { RandomBackground } from '@/components/random-background'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIGNAL — AI & Frontier Technology Intelligence Hub",
  description:
    "Personal intelligence workbench for tracking AI, embodied intelligence, mathematics, computer science, open source and the broader scientific frontier.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("signal.theme");
    var dark = stored !== "light";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <AppProviders>
          <RandomBackground />
          <SearchProvider>
            <AppShell>{children}</AppShell>
          </SearchProvider>
        </AppProviders>
      </body>
    </html>
  );
}

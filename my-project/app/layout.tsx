import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster as HotToaster } from 'react-hot-toast';
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/theme-provider";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vighnotech - Project Tracker",
  description: "Track project progress and manage tasks with Vighnotech's internal tool.",
};

import QueryProvider from "@/lib/query-provider";
import AuthGuard from "@/components/AuthGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HotToaster />
          <Toaster position="top-right" richColors />
          <AuthGuard>
            <QueryProvider>{children}</QueryProvider>
          </AuthGuard>
          <div id="modal-root"></div>
        </ThemeProvider>
      </body>
    </html>
  );
}

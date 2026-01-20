import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/authContext";
import { SocketProvider } from "@/context/socket-context";
import { GameProvider } from "@/context/game-context";
import { LanguageProvider } from "@/context/languageContext";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import GameInviteDialog from "@/components/game-invite-dialog";
import { ReconnectionManager } from "@/components/game/reconnection-manager";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "42 Transcend Into Unknown",
  description: "42-ft_transcendence-capybara",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <Suspense fallback={null}>
              <AuthProvider>
                <GameProvider>
                  <SocketProvider>
                    <Toaster position="top-center" />
                    <Header />
                    <GameInviteDialog />
                    <ReconnectionManager />
                    <main className="min-h-screen w-full">{children}</main>
                    <Footer />
                  </SocketProvider>
                </GameProvider>
              </AuthProvider>
            </Suspense>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

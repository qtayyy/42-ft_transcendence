import { Suspense } from "react";
import { Inter } from "next/font/google";
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
import { NavigationGuard } from "@/components/game/navigation-guard";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
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
        className={`${inter.variable} font-sans antialiased`}
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
                    <NavigationGuard />
                    <Suspense fallback={null}>
                      <Header />
                    </Suspense>
                    <GameInviteDialog />
                    <ReconnectionManager />
                    <main className="min-h-screen w-full">{children}</main>
                    <Suspense fallback={null}>
                      <Footer />
                    </Suspense>
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

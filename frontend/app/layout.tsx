import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/authContext";
import { SocketProvider } from "@/context/socket-context";
import { GameProvider } from "@/context/game-context";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import GameInviteDialog from "@/components/game-invite-dialog";

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
          <AuthProvider>
            <GameProvider>
              <SocketProvider>
                <Toaster position="top-center" />
                <Header />
                <GameInviteDialog />
                <main className="min-h-screen w-full">{children}</main>
                <Footer />
              </SocketProvider>
            </GameProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

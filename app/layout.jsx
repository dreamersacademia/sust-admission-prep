import { Sora, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// Display face for headings/numbers (English + digits) — used with restraint.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["500", "600", "700"],
});

// Body face — one of the few fonts that renders Bengali cleanly alongside Latin
// without a visual seam between scripts.
const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  variable: "--font-hind",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "SUST Admission Prep",
  description: "Practice, live exams, and merit tracking for SUST admission candidates.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className={`${sora.variable} ${hind.variable} font-body antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

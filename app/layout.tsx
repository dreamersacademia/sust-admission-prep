import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SUST Admission Prep — Free Exams',
  description: 'Free mock exams for SUST admission with instant results and a merit list.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&family=Tiro+Bangla&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-parchment font-body text-ink antialiased">{children}</body>
    </html>
  );
}

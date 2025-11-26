import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IsoCity - Isometric City Builder',
  description: 'A realistic SimCity-like isometric city builder with zoning, services, and live simulation. Build your dream metropolis!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-foreground antialiased font-sans">{children}</body>
    </html>
  );
}

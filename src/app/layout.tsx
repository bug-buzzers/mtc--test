import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Maples Tech Club — Entrance Portal | Maples Academy, Khatauli',
  description:
    'Online entrance quiz portal for Maples Tech Club at Maples Academy, Khatauli (Classes 6 to 12). Practical everyday computer literacy with random quiz selection.',
  openGraph: {
    title: 'Maples Tech Club — Entrance Portal',
    description:
      'Learn it. Build it. Ship it. Practical computer entrance quiz for Classes 6 to 12 at Maples Academy, Khatauli.',
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-[#F9FAFB] text-slate-900 antialiased selection:bg-maple-100 selection:text-maple-700">
        {/* Skip-to-content link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:font-medium focus:text-sm"
        >
          Skip to main content
        </a>

        {/* Fixed, pointer-events-none micro-grain overlay (zero scroll repaint cost) */}
        <div
          aria-hidden="true"
          className="no-print fixed inset-0 z-50 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {children}
      </body>
    </html>
  );
}

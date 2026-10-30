import type { Metadata } from 'next';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

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
    <html lang="en">
      <body className="font-sans bg-[#F9FAFB] text-slate-900 antialiased selection:bg-maple-100 selection:text-maple-700">
        {/* Skip-to-content link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:font-medium focus:text-sm"
        >
          Skip to main content
        </a>

        {children}
      </body>
    </html>
  );
}

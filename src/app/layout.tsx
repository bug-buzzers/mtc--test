import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { buildPortalMetadata } from '@/lib/share-test';

export const viewport: Viewport = {
  themeColor: '#C25934',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  let headersList: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    headersList = await headers();
  } catch {
    headersList = null;
  }

  return buildPortalMetadata(headersList);
}

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

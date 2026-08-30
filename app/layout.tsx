import type { Metadata, Viewport } from 'next';
import { Inter, Work_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { PwaRegistry } from '@/components/pwa-registry';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-work-sans' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const viewport: Viewport = {
  themeColor: '#003d9b',
};

export const metadata: Metadata = {
  title: 'CaragaSense AI',
  description: 'AI-powered Road Damage Detection System',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${workSans.variable} ${jetBrainsMono.variable}`}>
      <body className="antialiased font-sans bg-surface text-slate-900" suppressHydrationWarning>
        <PwaRegistry />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

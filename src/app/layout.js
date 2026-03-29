import { ClerkProvider } from '@clerk/nextjs';
import { UnitEconomicsProvider } from '@/context/UnitEconomicsContext';
import './globals.css';

export const metadata = {
  title: 'Unit Flow by OnEasy',
  description: 'AI-powered 17-sheet Unit Economics model builder. Describe your business, get a complete financial model.',
  icons: {
    icon: '/logos/unit-flow.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="antialiased min-h-screen">
        <ClerkProvider>
          <UnitEconomicsProvider>
            {children}
          </UnitEconomicsProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

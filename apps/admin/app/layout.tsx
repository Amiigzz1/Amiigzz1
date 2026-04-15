import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Majlis Admin',
  description: 'Internal moderation + withdrawal dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}

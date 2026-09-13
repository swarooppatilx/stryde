import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-figtree',
  display: 'swap',
});

const brunson = localFont({
  src: './fonts/Brunson.ttf',
  weight: '400',
  style: 'normal',
  variable: '--font-brunson',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stryde — Run with the community.',
  description:
    'Track your runs, capture territories, and share your progress with the Stryde community. On web3.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${brunson.variable}`}>
      <body>{children}</body>
    </html>
  );
}

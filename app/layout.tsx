import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pix2paper-convert.kapil-e18497.chatgpt.site'),
  title: 'Pix2Paper — Image to PDF & Compressor',
  description: 'Convert images to PDF or compress them privately in your browser. Fast, free, and no uploads required.',
  openGraph: {
    title: 'Pix2Paper — Image to PDF & Compressor',
    description: 'Images in. Perfect PDF out. Convert and compress privately in your browser.',
    images: [{ url: '/og.png', width: 1734, height: 907, alt: 'Pix2Paper — Images in. Perfect PDF out.' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pix2Paper — Image to PDF & Compressor',
    description: 'Images in. Perfect PDF out. Convert and compress privately in your browser.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

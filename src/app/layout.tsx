import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'YGH Companion — Deck Studio',
  description: 'Votre atelier Yu-Gi-Oh! : catalogue, deck builder et analyse de main de départ.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

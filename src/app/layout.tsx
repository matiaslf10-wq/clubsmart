import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://clubsmart.vercel.app",
  ),
  title: {
    default: "ClubSmart | Tecnología para clubes",
    template: "%s | ClubSmart",
  },
  description:
    "Plataforma para publicar actividades, administrar reservas, registrar pagos y organizar la información de clubes.",
  openGraph: {
    title: "ClubSmart",
    description:
      "Página, actividades, reservas y administración para clubes.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEXT Трекер",
  description:
    "Личный трекер подготовки к экзаменам MEXT (Natural Sciences): план на 209 дней, 284 темы, 754 задания, награды XP и монетами.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12081f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

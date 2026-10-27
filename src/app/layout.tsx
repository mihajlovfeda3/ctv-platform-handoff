import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "ЦТВ — технологическое видение", template: "%s · ЦТВ" },
  description:
    "Платформа цифрового технологического видения. Локальная среда разработки с синтетическими данными.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <a href="#main-content" className="skip-link">
          К основному содержимому
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

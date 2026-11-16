import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verde — GitHub Contribution Art Studio",
  description: "یک استودیوی تعاملی برای طراحی گراف مشارکت گیت‌هاب و ساخت اتوماسیون روزانه با GitHub Actions.",
  applicationName: "Verde Contribution Art Studio",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#080d10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

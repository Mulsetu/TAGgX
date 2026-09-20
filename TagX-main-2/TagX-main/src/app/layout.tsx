import type { Metadata } from "next";
import localFont from "next/font/local";
import { TAGX_ICON_SRC } from "@/lib/brand";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "TagX",
    template: "%s",
  },
  description: "Asset tagging",
  icons: {
    icon: TAGX_ICON_SRC,
    shortcut: TAGX_ICON_SRC,
    apple: TAGX_ICON_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

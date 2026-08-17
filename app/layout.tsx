import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { brandConfig } from "@/config/brand";
import { NativeNavigationFallback } from "@/components/layout/native-navigation-fallback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000").split(",")[0].trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = `${brandConfig.name} — ${brandConfig.tagline}`;
  const description = brandConfig.description;
  const socialImage = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title: { default: title, template: `%s · ${brandConfig.name}` },
    description,
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
        { url: "/favicon.png", type: "image/png", sizes: "64x64" },
        { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: origin,
      siteName: brandConfig.name,
      title,
      description,
      images: [{ url: socialImage, width: 1733, height: 907, alt: `${brandConfig.name} — ${brandConfig.tagline}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NativeNavigationFallback />
        {children}
      </body>
    </html>
  );
}

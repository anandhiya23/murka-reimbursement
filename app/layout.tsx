import type { Metadata } from "next";
import "./globals.css";
import BfcacheReload from "@/app/components/BfcacheReload";
import Providers from "@/app/components/Providers";
import { Toaster } from "@/components/ui/sonner";
import { Geist, Geist_Mono, Archivo } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// Geist Mono for IDs / member numbers / slugs; Archivo (condensed, characterful)
// as the EventID display face for uppercase labels and headings.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Murka System",
  description: "Murka System portal",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistMono.variable, archivo.variable)}>
      <body>
        <BfcacheReload />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}

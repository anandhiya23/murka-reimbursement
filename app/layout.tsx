import type { Metadata } from "next";
import "./globals.css";
import BfcacheReload from "@/app/components/BfcacheReload";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <BfcacheReload />
        {children}
      </body>
    </html>
  );
}

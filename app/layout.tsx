import type { Metadata } from "next";
import "./globals.css";
import BfcacheReload from "@/app/components/BfcacheReload";

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
    <html lang="en">
      <body>
        <BfcacheReload />
        {children}
      </body>
    </html>
  );
}

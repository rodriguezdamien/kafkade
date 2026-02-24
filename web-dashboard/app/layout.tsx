import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kafka Queue Dashboard",
  description: "Monitor and inspect Kafka topics and messages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

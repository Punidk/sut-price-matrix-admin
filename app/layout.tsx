import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SUT Central Price Matrix | Student Council Pre-Audit System",
  description:
    "Production-ready Admin Portal for managing Central Price Matrix document records in SUT Student Council Budget Pre-Audit System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-neutral-950 text-neutral-100 antialiased selection:bg-white selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

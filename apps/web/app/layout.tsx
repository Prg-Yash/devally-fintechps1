import type { Metadata } from "next";
import { Geist, Plus_Jakarta_Sans, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { AppThirdwebProvider } from "@/components/providers/thirdweb-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Devally Fintech",
  description: "Devally Fintech Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jakarta.variable} antialiased`}
      >
        <div id="google_translate_element" aria-hidden="true" />
        <Script
          id="google-translate-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.googleTranslateElementInit = function () {
                if (!window.google || !window.google.translate) return;
                new window.google.translate.TranslateElement(
                  {
                    pageLanguage: 'en',
                    autoDisplay: false,
                  },
                  'google_translate_element'
                );
              };
            `,
          }}
        />
        <Script
          id="google-translate-script"
          strategy="afterInteractive"
          src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        />
        <AppThirdwebProvider>{children}</AppThirdwebProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}

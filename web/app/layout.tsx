import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI App Factory — Otonom Uygulama Üretim Bandı",
  description: "Yapay zeka ile tam otonom web uygulaması üretimi. Fikir üret, onayla, pipeline başlat.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen noise-overlay">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen md:ml-64">
            <Header />
            <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

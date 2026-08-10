import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Package, Home } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Admin",
  description: "A small Shopify-style order management admin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex bg-gray-50 text-gray-900">
        <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 border-r border-gray-200 bg-white">
          <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200">
            <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white">
              <ShoppingBag size={16} />
            </div>
            <span className="font-semibold text-sm">Order Admin</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <Link
              href="/orders"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Home size={16} />
              Home
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-800"
            >
              <Package size={16} />
              Orders
            </Link>
          </nav>
          <div className="px-4 py-4 text-xs text-gray-400 border-t border-gray-200">
            A small Shopify-style demo admin
          </div>
        </aside>
        <div className="flex-1 md:pl-56 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}

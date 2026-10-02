"use client";

import { usePathname } from "next/navigation";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideGlobalNavbar =
    pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/customer");
  const hideGlobalFooter = pathname === "/";

  return (
    <>
      {!hideGlobalNavbar && (
        <header className="border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <p className="text-xl font-extrabold tracking-tight text-emerald-700 sm:hidden">JPMS</p>
              <p className="hidden text-2xl font-extrabold tracking-tight text-emerald-700 sm:block">JPMS 🐔</p>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold tracking-tight text-zinc-900">
                  Jamshaid Poultry Management System
                </p>
              </div>
            </div>
            <div className="mt-1 hidden sm:block">
              <p className="text-xs text-zinc-500">Smart Poultry Business &amp; Account Management</p>
            </div>
            {pathname === "/" && (
              <div className="mt-1 sm:hidden">
                <p className="text-[11px] text-zinc-500">Smart Poultry Business &amp; Account Management</p>
              </div>
            )}
          </div>
        </header>
      )}

      <div className="flex-1">{children}</div>

      {!hideGlobalFooter && (
        <footer className="border-t border-slate-200/70 bg-white px-4 py-3 md:px-6">
          <p className="text-center text-xs text-zinc-400">
            © 2026 Jamshaid Poultry Management System | Developed by Manan Malik
          </p>
        </footer>
      )}
    </>
  );
}

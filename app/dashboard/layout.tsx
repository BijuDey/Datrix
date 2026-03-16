"use client";

import { AuthProvider } from "@/lib/auth-context";
import { RequireOrg } from "@/components/auth/RequireOrg";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApiStudioRoute = pathname.startsWith("/dashboard/api-studio");

  return (
    <AuthProvider>
      <RequireOrg>
        <div className="flex min-h-screen bg-base text-primary">
          {!isApiStudioRoute ? <Sidebar /> : null}
          <main className={`flex-1 min-w-0 ${isApiStudioRoute ? "ml-0" : "ml-62"}`}>
            {children}
          </main>
        </div>
      </RequireOrg>
    </AuthProvider>
  );
}

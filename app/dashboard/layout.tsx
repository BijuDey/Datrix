import { AuthProvider } from "@/lib/auth-context";
import { RequireOrg } from "@/components/auth/RequireOrg";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireOrg>
        <div className="flex min-h-screen bg-base text-primary">
          <Sidebar />
          <main className="flex-1 min-w-0 ml-[248px]">
            {children}
          </main>
        </div>
      </RequireOrg>
    </AuthProvider>
  );
}

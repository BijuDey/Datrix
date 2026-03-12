"use client";

import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { org, loading, user, profile, refreshAuth } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#080808] items-center justify-center relative">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] animate-pulse" />
           <div className="w-32 h-2 bg-[#1a1a1a] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Not signed in? Middleware should catch this, but just in case:
  if (!user) {
    return null;
  }

  // Not signed in? Middleware should catch this, but just in case:
  if (!user) return null;

  if (!org) {
    return (
      <div className="flex min-h-screen bg-[#080808] items-center justify-center p-6">
        <div className="w-full max-w-sm border border-[#1a1a1a] bg-[#0f0f0f] rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6 mx-auto">
            <Users size={20} className="text-amber-400" />
          </div>
          <h1 className="text-[22px] font-bold text-center tracking-[-0.03em] text-[#f0f0f0] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Create your workspace
          </h1>
          <p className="text-[13px] text-[#8a8a8a] text-center mb-8 leading-relaxed">
            You need a workspace to connect databases, build queries, and collaborate with your team.
          </p>

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!orgName.trim()) return;
              setCreating(true);
              setError(null);
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const res = await fetch("/api/auth/signup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    fullName: profile?.full_name || user.email?.split("@")[0] || "User",
                    orgName: orgName.trim()
                  }),
                  signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (res.ok) {
                   window.location.href = "/dashboard";
                } else {
                   const data = await res.json();
                   setError(data.error || "Failed to create workspace");
                }
              } catch (err: any) {
                 if (err.name === "AbortError") {
                   setError("Connection to server timed out. Next.js might be busy.");
                 } else {
                   setError("Network error occurred");
                 }
              } finally {
                 setCreating(false);
              }
            }}
            className="space-y-5"
          >
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] text-center">
                {error}
              </div>
            )}
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Corp"
              label="Workspace Name"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={creating}
              icon={!creating ? <ArrowRight size={15} /> : undefined}
            >
              {creating ? "Creating..." : "Create workspace"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

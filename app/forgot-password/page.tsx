"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/settings?tab=password`,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-base)" }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={26} className="text-amber-400" />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] mb-2" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
            Check your inbox
          </h1>
          <p className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
            We sent a password reset link to <span style={{ color: "var(--text-primary)" }}>{email}</span>.
          </p>
          <Link href="/login" className="text-[13px] text-amber-400 hover:text-amber-300 transition-colors font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-base)" }}>
      <div className="w-full max-w-sm">
        <Link href="/" className="flex mb-10">
          <BrandLogo iconSize={28} showText textClassName="text-[15px] font-bold tracking-[-0.03em]" />
        </Link>

        <h1 className="text-[24px] font-bold tracking-[-0.03em] mb-1" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
          Reset password
        </h1>
        <p className="text-[13px] mb-8" style={{ color: "var(--text-muted)" }}>
          Remember it?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>

        {error && (
          <div className="flex items-center gap-2.5 p-3 mb-4 rounded-lg text-[12px]" style={{ background: "var(--error-dim)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--error)" }}>
            <AlertCircle size={13} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            prefix={<Mail size={13} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} icon={<ArrowRight size={15} />}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </div>
    </div>
  );
}

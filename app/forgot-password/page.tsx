"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

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
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={26} className="text-amber-400" />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#f0f0f0] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Check your inbox
          </h1>
          <p className="text-[13px] text-[#8a8a8a] leading-relaxed mb-6">
            We sent a password reset link to <span className="text-[#f0f0f0]">{email}</span>.
          </p>
          <Link href="/login" className="text-[13px] text-amber-400 hover:text-amber-300 transition-colors font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 mb-10">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/25">
            <Zap size={13} className="text-amber-400" />
          </div>
          <span className="text-[15px] font-bold tracking-[-0.03em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Datrix
          </span>
        </Link>

        <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[#f0f0f0] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Reset password
        </h1>
        <p className="text-[13px] text-[#8a8a8a] mb-8">
          Remember it?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>

        {error && (
          <div className="flex items-center gap-2.5 p-3 mb-4 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-[12px]">
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

"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Unexpected error — user not created.");
      setLoading(false);
      return;
    }

    // Redirect is handled after email confirmation check


    // Email confirmation enabled — show success state
    if (!authData.session) {
      setSuccess(true);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-base)" }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={26} className="text-green-400" />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] mb-2" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
            Check your email
          </h1>
          <p className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
            We sent a confirmation link to <span style={{ color: "var(--text-primary)" }}>{form.email}</span>.
            Click it to activate your account and access your workspace.
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
          Create your account
        </h1>
        <p className="text-[13px] mb-8" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
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
            label="Full name"
            type="text"
            placeholder="John Doe"
            prefix={<User size={13} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Work email"
            type="email"
            placeholder="you@company.com"
            prefix={<Mail size={13} />}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            hint="At least 8 characters"
            prefix={<Lock size={13} />}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="transition-colors" style={{ color: "var(--text-faint)" }}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            }
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            loading={loading}
            icon={<ArrowRight size={15} />}
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          By creating an account, you agree to our{" "}
          <Link href="#" className="hover:text-amber-400 transition-colors" style={{ color: "var(--text-muted)" }}>Terms</Link>
          {" "}and{" "}
          <Link href="#" className="hover:text-amber-400 transition-colors" style={{ color: "var(--text-muted)" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

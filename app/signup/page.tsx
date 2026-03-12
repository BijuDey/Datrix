"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

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

    // 2. Auto-generate org name from user's name
    const orgName = form.name.trim()
      ? `${form.name.trim()}'s Workspace`
      : form.email.split("@")[0] + "'s Workspace";

    // 3. Create org + membership via server API
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fullName: form.name, orgName }),
    });

    if (!res.ok) {
      const errData = await res.json();
      setError(errData.error || "Failed to set up your workspace.");
      setLoading(false);
      return;
    }

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
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={26} className="text-green-400" />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#f0f0f0] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Check your email
          </h1>
          <p className="text-[13px] text-[#8a8a8a] leading-relaxed mb-6">
            We sent a confirmation link to <span className="text-[#f0f0f0]">{form.email}</span>.
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
          Create your account
        </h1>
        <p className="text-[13px] text-[#8a8a8a] mb-8">
          Already have an account?{" "}
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
                className="text-[#444] hover:text-[#8a8a8a] transition-colors"
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

        <p className="mt-6 text-center text-[11px] text-[#444]">
          By creating an account, you agree to our{" "}
          <Link href="#" className="text-[#8a8a8a] hover:text-amber-400 transition-colors">Terms</Link>
          {" "}and{" "}
          <Link href="#" className="text-[#8a8a8a] hover:text-amber-400 transition-colors">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

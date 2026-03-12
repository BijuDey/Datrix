"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "Invalid email or password. Please try again."
        : authError.message);
      setLoading(false);
      return;
    }

    // Full page navigation ensures cookies are sent with the initial dashboard request
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-[#080808] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col flex-1 bg-[#0a0a0a] border-r border-[#141414] p-10 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/4 rounded-full blur-[100px] pointer-events-none" />

        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25">
            <Zap size={15} className="text-amber-400" />
          </div>
          <span className="text-[16px] font-bold tracking-[-0.03em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Datrix
          </span>
        </Link>

        <div className="flex-1 flex flex-col justify-center relative z-10 max-w-sm">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Zap size={22} className="text-amber-400" />
            </div>
            <h2
              className="text-[28px] font-bold tracking-[-0.03em]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Your data,<br />under control.
            </h2>
            <p className="text-[14px] text-[#8a8a8a] leading-relaxed">
              A modern, open-source platform to manage SQL databases, S3 storage, teams, and more.
            </p>
          </div>

          <div className="mt-12 space-y-3">
            {[
              "Connect multiple databases in seconds",
              "Run SQL queries with instant results",
              "Browse S3 buckets with ease",
              "Full audit trail of every action",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="text-[13px] text-[#8a8a8a]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[12px] text-[#444]">© 2024 Datrix. MIT Licensed.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:max-w-[480px]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-2 mb-10">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/25">
              <Zap size={13} className="text-amber-400" />
            </div>
            <span className="text-[15px] font-bold tracking-[-0.03em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Datrix
            </span>
          </Link>

          <h1
            className="text-[24px] font-bold tracking-[-0.03em] text-[#f0f0f0] mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Welcome back
          </h1>
          <p className="text-[13px] text-[#8a8a8a] mb-8">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Sign up
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
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
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

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[12px] text-[#8a8a8a] hover:text-amber-400 transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
              icon={<ArrowRight size={15} />}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

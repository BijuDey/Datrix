"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";

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

    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col flex-1 p-10 relative overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "var(--accent-glow)" }}
        />

        <Link href="/" className="relative z-10">
          <BrandLogo iconSize={32} showText textClassName="text-[16px] font-bold tracking-[-0.03em]" />
        </Link>

        <div className="flex-1 flex flex-col justify-center relative z-10 max-w-sm">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Zap size={22} className="text-amber-400" />
            </div>
            <h2
              className="text-[28px] font-bold tracking-[-0.03em]"
              style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Your data,<br />under control.
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(251,191,36,0.6)" }} />
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[12px]" style={{ color: "var(--text-faint)" }}>© 2024 Datrix. MIT Licensed.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:max-w-[480px]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden mb-10">
            <BrandLogo iconSize={28} showText textClassName="text-[15px] font-bold tracking-[-0.03em]" />
          </Link>

          <h1
            className="text-[24px] font-bold tracking-[-0.03em] mb-1"
            style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Welcome back
          </h1>
          <p className="text-[13px] mb-8" style={{ color: "var(--text-muted)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>

          {error && (
            <div
              className="flex items-center gap-2.5 p-3 mb-4 rounded-lg text-[12px]"
              style={{
                background: "var(--error-dim)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "var(--error)",
              }}
            >
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
                  className="transition-colors"
                  style={{ color: "var(--text-faint)" }}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              }
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[12px] hover:text-amber-400 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
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

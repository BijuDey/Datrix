import Link from "next/link";
import { ArrowRight, Zap, Database, HardDrive, Users, ScrollText, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f0f0f0]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 h-[60px] border-b border-[#141414]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/25">
            <Zap size={13} className="text-amber-400" />
          </div>
          <span className="text-[15px] font-bold tracking-[-0.03em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Datrix
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[13px] text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors font-medium"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-amber-500 text-black text-[13px] font-semibold hover:bg-amber-400 transition-colors"
          >
            Get started
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-4 pt-24 pb-20 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/6 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
            <Zap size={11} className="text-amber-400" />
            <span className="text-[12px] font-medium text-amber-300">Open-Source Data Control Platform</span>
          </div>

          <h1
            className="text-[52px] font-bold tracking-[-0.04em] leading-[1.05] mb-6"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Manage your data
            <br />
            <span className="text-amber-400">infrastructure</span>
            <br />
            from one place
          </h1>

          <p className="text-[17px] text-[#8a8a8a] max-w-xl mx-auto mb-10 leading-relaxed">
            Connect SQL databases, browse S3 storage, run queries, manage teams, and monitor activity — all in a single, beautiful interface.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 h-11 px-6 rounded-lg bg-amber-500 text-black text-[14px] font-semibold hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]"
            >
              Start for free
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 h-11 px-6 rounded-lg bg-[#161616] border border-[#2a2a2a] text-[#f0f0f0] text-[14px] font-medium hover:border-[#383838] hover:bg-[#1e1e1e] transition-all"
            >
              View demo
            </Link>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="relative z-10 mt-16 w-full max-w-4xl mx-auto">
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] overflow-hidden shadow-2xl shadow-black/50">
            {/* Fake window bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-[#1a1a1a]">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <div className="ml-4 flex-1 bg-[#161616] h-6 rounded-md border border-[#252525]" />
            </div>
            {/* Fake dashboard layout */}
            <div className="flex h-[320px]">
              {/* Fake sidebar */}
              <div className="w-[200px] bg-[#090909] border-r border-[#141414] p-4 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/30" />
                  <div className="h-3 w-16 bg-[#1e1e1e] rounded" />
                </div>
                {["Overview", "Databases", "Storage", "Teams", "Logs"].map((item) => (
                  <div key={item} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-[#141414]">
                    <div className="w-3 h-3 rounded bg-[#252525]" />
                    <div className="h-2 rounded text-[10px] text-[#444] font-medium">{item}</div>
                  </div>
                ))}
              </div>
              {/* Fake main area */}
              <div className="flex-1 p-6 space-y-4">
                <div className="h-4 w-32 bg-[#1e1e1e] rounded" />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Connections", color: "amber" },
                    { label: "Queries today", color: "green" },
                    { label: "Team members", color: "blue" },
                  ].map((card) => (
                    <div key={card.label} className="p-4 rounded-lg bg-[#111] border border-[#1f1f1f] space-y-2">
                      <div className={`h-2 w-20 rounded bg-${card.color}-500/20`} />
                      <div className="h-6 w-12 rounded bg-[#1e1e1e]" />
                      <div className="h-2 w-24 rounded bg-[#161616]" />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-[#111] border border-[#1f1f1f] h-32 p-4">
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="h-2 w-24 rounded bg-[#1e1e1e]" />
                        <div className="h-2 w-32 rounded bg-[#161616]" />
                        <div className="h-2 w-16 rounded bg-[#141414]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-[32px] font-bold tracking-[-0.03em] mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Everything you need
          </h2>
          <p className="text-[15px] text-[#8a8a8a]">
            A complete toolkit for managing your data infrastructure
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Database,
              title: "Database Manager",
              description: "Connect PostgreSQL & MySQL databases with encrypted credentials and one-click connection testing.",
            },
            {
              icon: Zap,
              title: "SQL Editor",
              description: "Syntax-highlighted multi-tab SQL editor with query history and instant results.",
            },
            {
              icon: HardDrive,
              title: "S3 Storage Browser",
              description: "Browse buckets, upload, download, delete, and preview files from any S3-compatible store.",
            },
            {
              icon: Users,
              title: "Teams & Roles",
              description: "Invite team members with Owner, Admin, Editor, or Viewer roles. Share database connections securely.",
            },
            {
              icon: ScrollText,
              title: "Activity Logs",
              description: "Track every query, row change, and schema modification with user, IP, timestamp, and full context.",
            },
            {
              icon: Shield,
              title: "Self-Hosted & Open Source",
              description: "Deploy on your own infrastructure. Full source code available. Configurable and forkable.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#111] transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#161616] border border-[#252525] flex items-center justify-center mb-4 group-hover:border-amber-500/30 group-hover:bg-amber-500/8 transition-all">
                <feature.icon size={17} className="text-[#8a8a8a] group-hover:text-amber-400 transition-colors" />
              </div>
              <h3
                className="text-[14px] font-semibold text-[#f0f0f0] mb-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {feature.title}
              </h3>
              <p className="text-[13px] text-[#8a8a8a] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-4 py-20 border-t border-[#141414]">
        <h2
          className="text-[28px] font-bold tracking-[-0.03em] mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Ready to take control?
        </h2>
        <p className="text-[14px] text-[#8a8a8a] mb-8">Free to self-host. MIT licensed.</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 h-11 px-8 rounded-lg bg-amber-500 text-black text-[14px] font-semibold hover:bg-amber-400 transition-all"
        >
          Get started — it&apos;s free
          <ArrowRight size={15} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#141414] px-8 py-6 flex items-center justify-between text-[12px] text-[#444]">
        <div className="flex items-center gap-2">
          <Zap size={11} className="text-amber-500/50" />
          <span>Datrix v0.1.0 — MIT License</span>
        </div>
        <div className="flex gap-6">
          <Link href="#" className="hover:text-[#8a8a8a] transition-colors">GitHub</Link>
          <Link href="#" className="hover:text-[#8a8a8a] transition-colors">Docs</Link>
          <Link href="#" className="hover:text-[#8a8a8a] transition-colors">Twitter</Link>
        </div>
      </footer>
    </div>
  );
}

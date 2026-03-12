"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HardDrive, Plus, Folder, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface S3Connection {
  id: string;
  name: string;
  encrypted_config: string;
}

export default function StoragePage() {
  const { org, isAdmin } = useAuth();
  const router = useRouter();
  const [connections, setConnections] = useState<S3Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) {
      setLoading(false);
      return;
    }
    loadS3Connections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function loadS3Connections() {
    const supabase = createClient();
    const { data } = await supabase
      .from("database_connections")
      .select("id, name")
      .eq("type", "s3");
    setConnections((data || []) as S3Connection[]);
    setLoading(false);
  }

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Storage" description="Browse and manage object storage" />
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="S3 Storage Browser" description="Browse buckets and manage files across your S3 connections">
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => window.location.href = "/dashboard/databases?new=1"}>
            Add S3 Connection
          </Button>
        </PageHeader>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
          </div>
        ) : connections.length === 0 ? (
          <div className="py-20 text-center rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] border-dashed">
            <HardDrive size={36} className="text-[#333] mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-[#555]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              No S3 connections
            </p>
            <p className="text-[13px] text-[#444] mt-1 mb-6">Add an S3-compatible storage connection to browse files</p>
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => window.location.href = "/dashboard/databases?new=1"}>
              Add S3 Connection
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#252525] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#161616] border border-[#252525] flex items-center justify-center shrink-0">
                  <HardDrive size={16} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[#f0f0f0]">{conn.name}</h3>
                  <p className="text-[11px] text-[#444]">S3-compatible object storage</p>
                </div>
                <Badge variant="default">S3</Badge>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" icon={<Folder size={12} />} onClick={() => router.push(`/dashboard/storage/${conn.id}`)}>
                    Browse
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

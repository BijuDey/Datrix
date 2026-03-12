"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  HardDrive, Folder, FolderOpen, File, FileText, FileImage,
  FileCode, Download, Trash2, Upload, ArrowLeft, ChevronRight,
  Copy, RefreshCw, Search, X, AlertCircle, Eye, CheckCircle,
  FileArchive, FileVideo, FileAudio, Loader2, Maximize2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatRelativeTime, cn } from "@/lib/utils";

interface S3Item {
  type: "folder" | "file";
  key: string;
  name: string;
  size?: number;
  lastModified?: string | null;
  etag?: string | null;
}

interface UploadProgress {
  name: string;
  progress: number;
  done: boolean;
  error?: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico", "bmp"];
  const codeExts = ["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "c", "cpp", "h", "json", "yaml", "yml", "toml", "xml", "html", "css", "sh", "bash", "md", "sql"];
  const archiveExts = ["zip", "tar", "gz", "rar", "7z", "bz2", "xz"];
  const videoExts = ["mp4", "mov", "avi", "mkv", "webm"];
  const audioExts = ["mp3", "wav", "flac", "ogg", "m4a", "aac"];
  const textExts = ["txt", "log", "csv", "tsv", "ini", "conf", "env"];

  if (imageExts.includes(ext)) return { Icon: FileImage, color: "text-pink-400" };
  if (codeExts.includes(ext)) return { Icon: FileCode, color: "text-blue-400" };
  if (archiveExts.includes(ext)) return { Icon: FileArchive, color: "text-yellow-400" };
  if (videoExts.includes(ext)) return { Icon: FileVideo, color: "text-purple-400" };
  if (audioExts.includes(ext)) return { Icon: FileAudio, color: "text-green-400" };
  if (textExts.includes(ext)) return { Icon: FileText, color: "text-[#aaa]" };
  return { Icon: File, color: "text-[#666]" };
}

function getPreviewKind(name: string): "image" | "video" | "audio" | "pdf" | "text" | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"];
  const videoExts = ["mp4", "webm", "ogg", "mov", "m4v"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "weba"];
  const textExts = ["txt", "log", "csv", "tsv", "json", "yaml", "yml", "md", "xml",
    "html", "css", "js", "ts", "tsx", "jsx", "sh", "bash", "ini", "conf", "toml",
    "sql", "env", "tf", "go", "py", "rs", "java", "c", "cpp", "h", "rb", "php",
    "swift", "kt", "dart", "vue", "svelte", "graphql", "proto", "diff", "patch"];
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (textExts.includes(ext)) return "text";
  return null;
}

export default function S3BrowserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [connectionName, setConnectionName] = useState<string>("");
  const [prefix, setPrefix] = useState("");
  const [items, setItems] = useState<S3Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<S3Item | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "video" | "audio" | "pdf" | "text" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<S3Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ── fullscreen viewer ──────────────────────────────────────────────────────
  const [fullscreenItem, setFullscreenItem] = useState<S3Item | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [fullscreenText, setFullscreenText] = useState<string | null>(null);
  const [fullscreenKind, setFullscreenKind] = useState<"image" | "video" | "audio" | "pdf" | "text" | null>(null);
  const [fullscreenLoading, setFullscreenLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeFullscreen(); }
    if (fullscreenItem) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenItem]);

  function closeFullscreen() {
    setFullscreenItem(null);
    setFullscreenUrl(null);
    setFullscreenText(null);
    setFullscreenKind(null);
  }

  async function handleFullscreen(item: S3Item) {
    const kind = getPreviewKind(item.name);
    setFullscreenItem(item);
    setFullscreenUrl(null);
    setFullscreenText(null);
    setFullscreenKind(kind);
    if (!kind) return;
    setFullscreenLoading(true);
    try {
      const res = await fetch(`/api/connections/${id}/s3?action=presign-download&key=${encodeURIComponent(item.key)}`);
      const data = await res.json();
      if (!res.ok) return;
      if (kind === "text") {
        const text = await fetch(data.url).then((r) => r.text()).catch(() => "[Could not load content]");
        setFullscreenText(text);
      } else {
        setFullscreenUrl(data.url);
      }
    } finally { setFullscreenLoading(false); }
  }

  // Load connection name
  useEffect(() => {
    const supabase = createClient();
    supabase.from("database_connections").select("name").eq("id", id).single()
      .then(({ data }) => { if (data) setConnectionName(data.name); });
  }, [id]);

  const loadObjects = useCallback(async (p = prefix) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${id}/s3?action=list&prefix=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to list objects"); return; }
      setItems([...data.folders, ...data.files]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, prefix]);

  useEffect(() => { loadObjects(prefix); }, [prefix]); // eslint-disable-line

  function navigateToFolder(key: string) {
    setSelected(null);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewKind(null);
    setSearch("");
    setPrefix(key);
  }

  function navigateToBreadcrumb(index: number) {
    const parts = prefix.split("/").filter(Boolean);
    const newPrefix = parts.slice(0, index).join("/") + (index > 0 ? "/" : "");
    navigateToFolder(newPrefix);
  }

  const breadcrumbs = ["Root", ...prefix.split("/").filter(Boolean)];

  async function handleDownload(item: S3Item) {
    try {
      const res = await fetch(
        `/api/connections/${id}/s3?action=presign-download&key=${encodeURIComponent(item.key)}&filename=${encodeURIComponent(item.name)}`
      );
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      const a = document.createElement("a");
      a.href = data.url;
      a.download = item.name;
      a.click();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/connections/${id}/s3`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: deleteTarget.key }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setItems((prev) => prev.filter((i) => i.key !== deleteTarget.key));
      if (selected?.key === deleteTarget.key) { setSelected(null); setPreviewUrl(null); setPreviewText(null); setPreviewKind(null); }
    } catch (e: any) { alert(e.message); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  async function handlePreview(item: S3Item) {
    setSelected(item);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewKind(null);
    const kind = getPreviewKind(item.name);
    if (!kind) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/connections/${id}/s3?action=presign-download&key=${encodeURIComponent(item.key)}`);
      const data = await res.json();
      if (!res.ok) return;
      setPreviewKind(kind);
      if (kind === "text") {
        const text = await fetch(data.url).then((r) => r.text()).catch(() => "[Could not load content]");
        setPreviewText(text);
      } else {
        // image / video / audio / pdf all use the presigned URL directly
        setPreviewUrl(data.url);
      }
    } finally { setPreviewLoading(false); }
  }

  async function handleCopyPath(item: S3Item) {
    await navigator.clipboard.writeText(`s3://${item.key}`);
    setCopiedKey(item.key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const fileArr = Array.from(files);
    setUploads(fileArr.map((f) => ({ name: f.name, progress: 0, done: false })));

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const key = prefix + file.name;
      try {
        const res = await fetch(
          `/api/connections/${id}/s3?action=presign-upload&key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        await fetch(data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, progress: 100, done: true } : u));
      } catch (e: any) {
        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, error: e.message, done: true } : u));
      }
    }
    setTimeout(() => { setUploads([]); loadObjects(prefix); }, 1800);
  }

  function sortItems(toSort: S3Item[]) {
    const folders = toSort.filter((i) => i.type === "folder");
    const files = toSort.filter((i) => i.type === "file");
    function cmp(a: S3Item, b: S3Item) {
      let v = 0;
      if (sortBy === "name") v = a.name.localeCompare(b.name);
      else if (sortBy === "size") v = (a.size ?? 0) - (b.size ?? 0);
      else v = (a.lastModified ?? "").localeCompare(b.lastModified ?? "");
      return sortDir === "asc" ? v : -v;
    }
    return [...folders.sort(cmp), ...files.sort(cmp)];
  }

  const filtered = sortItems(
    items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  function SortBtn({ field, label }: { field: "name" | "size" | "date"; label: string }) {
    const active = sortBy === field;
    return (
      <button
        onClick={() => { if (active) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortBy(field); setSortDir("asc"); } }}
        className={cn("text-[11px] px-2 py-0.5 rounded transition-colors", active ? "text-[#f0f0f0] bg-[#252525]" : "text-[#555] hover:text-[#888]")}
      >
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    );
  }

  return (
    <div className="min-h-screen pt-[52px] flex flex-col">
      <TopBar title="Storage" description="Browse and manage object storage" />

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#1a1a1a] bg-[#080808]">
        <button onClick={() => router.push("/dashboard/storage")} className="text-[#555] hover:text-[#aaa] transition-colors">
          <ArrowLeft size={15} />
        </button>
        <HardDrive size={14} className="text-yellow-400" />
        <span className="text-[13px] font-semibold text-[#f0f0f0]">{connectionName || "S3 Browser"}</span>
        <ChevronRight size={12} className="text-[#333]" />
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={10} className="text-[#333]" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={cn(
                  "text-[12px] px-1.5 py-0.5 rounded transition-colors",
                  i === breadcrumbs.length - 1
                    ? "text-[#f0f0f0] font-medium cursor-default"
                    : "text-[#555] hover:text-[#aaa]"
                )}
              >
                {crumb}
              </button>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => loadObjects(prefix)} className="p-1.5 text-[#555] hover:text-[#aaa] transition-colors" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#252525] text-[12px] text-[#ccc] hover:border-[#353535] hover:text-[#f0f0f0] transition-all">
            <Upload size={12} />
            Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        </div>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="px-6 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] space-y-1">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3">
              {u.done && !u.error ? (
                <CheckCircle size={12} className="text-green-400 shrink-0" />
              ) : u.error ? (
                <AlertCircle size={12} className="text-red-400 shrink-0" />
              ) : (
                <Loader2 size={12} className="text-blue-400 shrink-0 animate-spin" />
              )}
              <span className="text-[11px] text-[#888] truncate flex-1">{u.name}</span>
              {u.error && <span className="text-[11px] text-red-400">{u.error}</span>}
              {u.done && !u.error && <span className="text-[11px] text-green-400">Uploaded</span>}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File listing */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1a]">
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name…"
                className="w-full pl-8 pr-3 py-1.5 bg-[#111] border border-[#1e1e1e] rounded-lg text-[12px] text-[#ccc] placeholder-[#444] focus:outline-none focus:border-[#333] transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]">
                  <X size={11} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#444] mr-1">Sort:</span>
              <SortBtn field="name" label="Name" />
              <SortBtn field="size" label="Size" />
              <SortBtn field="date" label="Date" />
            </div>
            <span className="text-[11px] text-[#3a3a3a] ml-auto">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <AlertCircle size={28} className="text-red-400 mb-3" />
                <p className="text-[13px] font-semibold text-red-400 mb-1">Failed to list objects</p>
                <p className="text-[12px] text-[#666] mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => loadObjects(prefix)}>Try again</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <Folder size={28} className="text-[#333] mb-3" />
                <p className="text-[13px] text-[#555]">
                  {search ? "No items match your filter" : "This folder is empty"}
                </p>
                {search && (
                  <button onClick={() => setSearch("")} className="mt-2 text-[12px] text-blue-400 hover:underline">Clear filter</button>
                )}
              </div>
            ) : (
              <div className="p-2">
                {/* Column header */}
                <div className="grid grid-cols-[1fr_80px_120px_80px] gap-2 px-3 py-1 mb-1">
                  <span className="text-[10px] text-[#333] uppercase tracking-wider">Name</span>
                  <span className="text-[10px] text-[#333] uppercase tracking-wider text-right">Size</span>
                  <span className="text-[10px] text-[#333] uppercase tracking-wider text-right">Modified</span>
                  <span />
                </div>

                {filtered.map((item) => {
                  const isSelected = selected?.key === item.key;
                  const isCopied = copiedKey === item.key;
                  const { Icon, color } = item.type === "folder"
                    ? { Icon: isSelected ? FolderOpen : Folder, color: "text-yellow-400" }
                    : getFileIcon(item.name);

                  return (
                    <div
                      key={item.key}
                      onClick={() => item.type === "folder" ? navigateToFolder(item.key) : handlePreview(item)}
                      className={cn(
                        "group grid grid-cols-[1fr_80px_120px_80px] gap-2 items-center px-3 py-2 rounded-lg cursor-pointer transition-all",
                        isSelected ? "bg-[#151515] border border-[#252525]" : "hover:bg-[#0f0f0f] border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={15} className={cn(color, "shrink-0")} />
                        <span className="text-[13px] text-[#d0d0d0] truncate" title={item.name}>{item.name}</span>
                        {item.type === "folder" && (
                          <ChevronRight size={11} className="text-[#333] shrink-0 ml-auto" />
                        )}
                      </div>
                      <span className="text-[11px] text-[#555] text-right">
                        {item.type === "file" ? formatBytes(item.size ?? 0) : ""}
                      </span>
                      <span className="text-[11px] text-[#555] text-right truncate">
                        {item.type === "file" && item.lastModified ? formatRelativeTime(item.lastModified) : ""}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.type === "file" && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleFullscreen(item); }}
                              className="p-1 rounded text-[#555] hover:text-blue-400 hover:bg-[#0a0f1a] transition-all"
                              title="View fullscreen"
                            >
                              <Maximize2 size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                              className="p-1 rounded text-[#555] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all"
                              title="Download"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyPath(item); }}
                              className="p-1 rounded text-[#555] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all"
                              title="Copy S3 path"
                            >
                              {isCopied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                              className="p-1 rounded text-[#555] hover:text-red-400 hover:bg-[#1a0000] transition-all"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {selected && (
          <div className="w-72 border-l border-[#1a1a1a] flex flex-col bg-[#080808] shrink-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
              <Eye size={13} className="text-[#555]" />
              <span className="text-[12px] font-semibold text-[#aaa] flex-1 truncate">Preview</span>
              <button onClick={() => { setSelected(null); setPreviewUrl(null); setPreviewText(null); setPreviewKind(null); }} className="text-[#444] hover:text-[#888] transition-colors">
                <X size={13} />
              </button>
            </div>

            {/* File info */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] space-y-2">
              <p className="text-[12px] font-semibold text-[#e0e0e0] break-all">{selected.name}</p>
              {selected.type === "file" && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[11px] text-[#444]">Size</span>
                    <span className="text-[11px] text-[#888]">{formatBytes(selected.size ?? 0)}</span>
                  </div>
                  {selected.lastModified && (
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#444]">Modified</span>
                      <span className="text-[11px] text-[#888]">{formatRelativeTime(selected.lastModified)}</span>
                    </div>
                  )}
                  {selected.etag && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-[#444] shrink-0">ETag</span>
                      <span className="text-[11px] text-[#888] truncate font-mono">{selected.etag}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {previewLoading ? (
                <div className="flex items-center justify-center flex-1 gap-3 flex-col">
                  <Loader2 size={22} className="text-[#444] animate-spin" />
                  <p className="text-[11px] text-[#444]">Loading preview…</p>
                </div>
              ) : previewKind === "image" && previewUrl ? (
                <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-[#050505]" style={{ backgroundImage: "radial-gradient(#1a1a1a 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt={selected.name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
                </div>
              ) : previewKind === "video" && previewUrl ? (
                <div className="flex-1 flex items-center justify-center bg-black p-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-full rounded"
                    style={{ maxHeight: "calc(100vh - 300px)" }}
                  />
                </div>
              ) : previewKind === "audio" && previewUrl ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 bg-[#050505]">
                  <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-[#1e1e1e] flex items-center justify-center">
                    <FileAudio size={28} className="text-green-400" />
                  </div>
                  <p className="text-[11px] text-[#555] text-center truncate w-full px-2">{selected.name}</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              ) : previewKind === "pdf" && previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="flex-1 w-full border-0"
                  title={selected.name}
                />
              ) : previewKind === "text" && previewText !== null ? (
                <pre className="flex-1 overflow-auto p-3 text-[10px] text-[#888] font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {previewText.slice(0, 16000)}
                  {previewText.length > 16000 ? "\n\n… [truncated — download for full file]" : ""}
                </pre>
              ) : selected.type === "file" ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-[#1e1e1e] flex items-center justify-center mb-1">
                    {(() => { const { Icon, color } = getFileIcon(selected.name); return <Icon size={26} className={color} />; })()}
                  </div>
                  <p className="text-[12px] font-semibold text-[#555]">No preview available</p>
                  <p className="text-[11px] text-[#3a3a3a]">Download to open this file</p>
                  <button onClick={() => handleDownload(selected)} className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[12px] text-[#888] hover:text-[#ccc] hover:border-[#2a2a2a] transition-all">
                    <Download size={12} />
                    Download
                  </button>
                </div>
              ) : null}
            </div>

            {/* Preview actions */}
            {selected.type === "file" && (
              <div className="px-4 py-3 border-t border-[#1a1a1a] flex gap-2">
                <Button variant="outline" size="sm" icon={<Download size={12} />} onClick={() => handleDownload(selected)} className="flex-1">
                  Download
                </Button>
                <button
                  onClick={() => setDeleteTarget(selected)}
                  className="p-2 rounded-lg border border-[#1e1e1e] text-[#555] hover:text-red-400 hover:border-red-400/20 hover:bg-red-400/5 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen Viewer ─────────────────────────────────────────────── */}
      {fullscreenItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) closeFullscreen(); }}
        >
          {/* toolbar */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#080808]">
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              {(() => { const { Icon, color } = getFileIcon(fullscreenItem.name); return <Icon size={14} className={color} />; })()}
              <span className="text-[13px] text-[#d0d0d0] font-medium truncate">{fullscreenItem.name}</span>
              {fullscreenKind && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111] border border-[#1e1e1e] text-[#555] uppercase tracking-wide shrink-0">
                  {fullscreenKind}
                </span>
              )}
            </div>
            <button
              onClick={() => handleDownload(fullscreenItem)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] border border-[#1e1e1e] text-[11px] text-[#888] hover:text-[#ccc] hover:border-[#2a2a2a] transition-all"
            >
              <Download size={12} />
              Download
            </button>
            <button
              onClick={closeFullscreen}
              className="p-1.5 rounded-lg text-[#555] hover:text-[#ccc] hover:bg-[#1a1a1a] transition-all"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* content area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {fullscreenLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <Loader2 size={24} className="text-[#444] animate-spin" />
                <p className="text-[12px] text-[#444]">Loading…</p>
              </div>
            ) : fullscreenKind === "image" && fullscreenUrl ? (
              <div
                className="flex-1 overflow-auto flex items-center justify-center p-6"
                style={{ backgroundImage: "radial-gradient(#1a1a1a 1px, transparent 1px)", backgroundSize: "20px 20px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fullscreenUrl} alt={fullscreenItem.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              </div>
            ) : fullscreenKind === "video" && fullscreenUrl ? (
              <div className="flex-1 flex items-center justify-center bg-black p-4">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={fullscreenUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" />
              </div>
            ) : fullscreenKind === "audio" && fullscreenUrl ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8">
                <div className="w-24 h-24 rounded-3xl bg-[#0f0f0f] border border-[#1e1e1e] flex items-center justify-center">
                  <FileAudio size={40} className="text-green-400" />
                </div>
                <p className="text-[14px] text-[#666] text-center">{fullscreenItem.name}</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={fullscreenUrl} controls autoPlay className="w-full max-w-lg" style={{ colorScheme: "dark" }} />
              </div>
            ) : fullscreenKind === "pdf" && fullscreenUrl ? (
              <iframe src={fullscreenUrl} className="flex-1 w-full border-0" title={fullscreenItem.name} />
            ) : fullscreenKind === "text" && fullscreenText !== null ? (
              <pre className="flex-1 overflow-auto p-6 text-[12px] text-[#aaa] font-mono leading-relaxed whitespace-pre-wrap break-words">
                {fullscreenText.slice(0, 100000)}
                {fullscreenText.length > 100000 ? "\n\n… [truncated — download for full file]" : ""}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-4">
                {(() => { const { Icon, color } = getFileIcon(fullscreenItem.name); return <Icon size={56} className={color} />; })()}
                <p className="text-[15px] font-semibold text-[#555]">No preview available</p>
                <p className="text-[12px] text-[#3a3a3a]">Download to open this file</p>
                <button
                  onClick={() => handleDownload(fullscreenItem)}
                  className="mt-1 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[12px] text-[#888] hover:text-[#ccc] hover:border-[#2a2a2a] transition-all"
                >
                  <Download size={13} />
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[360px] rounded-2xl bg-[#0f0f0f] border border-[#1e1e1e] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                <Trash2 size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#f0f0f0]">Delete file?</p>
                <p className="text-[11px] text-[#555]">This cannot be undone</p>
              </div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2 mb-5">
              <p className="text-[12px] text-[#888] font-mono truncate">{deleteTarget.name}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} className="flex-1">
                Cancel
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 text-[12px] font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

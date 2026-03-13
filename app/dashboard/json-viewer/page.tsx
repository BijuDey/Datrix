"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Braces, CheckCircle2, Copy, GitBranch, Maximize2, Minimize2, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ViewerTab = "text" | "tree";

const SAMPLE_JSON = `{
  "project": "datrix",
  "features": {
    "jsonViewer": true,
    "darkMode": true
  },
  "items": [
    { "id": 1, "name": "Alpha" },
    { "id": 2, "name": "Beta" }
  ]
}`;

function JsonTreeNode({ name, value, depth = 0 }: { name?: string; value: JsonValue; depth?: number }) {
  const [open, setOpen] = useState(true);

  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  if (!isObject) {
    return (
      <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 14}px` }}>
        {name ? <span className="text-blue-400">"{name}"</span> : null}
        {name ? <span className="text-faint">: </span> : null}
        {typeof value === "string" ? (
          <span className="text-green-400">"{value}"</span>
        ) : typeof value === "number" ? (
          <span className="text-amber-400">{value}</span>
        ) : typeof value === "boolean" ? (
          <span className="text-purple-400">{String(value)}</span>
        ) : (
          <span className="text-red-400">null</span>
        )}
      </div>
    );
  }

  const entries = isArray
    ? (value as JsonValue[]).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, JsonValue>);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left font-mono text-[12px] leading-6 hover:bg-surface rounded transition-colors"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <span className="text-faint mr-1">{open ? "▾" : "▸"}</span>
        {name ? <span className="text-blue-400">"{name}"</span> : null}
        {name ? <span className="text-faint">: </span> : null}
        <span className="text-secondary">{isArray ? "[ ]" : "{ }"}</span>
        <span className="text-faint ml-2">{entries.length} item{entries.length === 1 ? "" : "s"}</span>
      </button>

      {open && (
        <div className="mt-1">
          {entries.map(([k, v]) => (
            <JsonTreeNode key={`${depth}-${k}`} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function JsonPrimitive({ value }: { value: JsonValue }) {
  if (typeof value === "string") return <span className="text-green-400">"{value}"</span>;
  if (typeof value === "number") return <span className="text-amber-400">{value}</span>;
  if (typeof value === "boolean") return <span className="text-purple-400">{String(value)}</span>;
  return <span className="text-red-400">null</span>;
}

function CollapsibleFormattedNode({
  name,
  value,
  depth = 0,
  trailingComma = false,
}: {
  name?: string;
  value: JsonValue;
  depth?: number;
  trailingComma?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isObject = typeof value === "object" && value !== null;

  const keyPrefix = name ? (
    <>
      <span className="text-blue-400">"{name}"</span>
      <span className="text-faint">: </span>
    </>
  ) : null;

  if (!isObject) {
    return (
      <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyPrefix}
        <JsonPrimitive value={value} />
        {trailingComma ? <span className="text-faint">,</span> : null}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 16}px` }}>
          {keyPrefix}
          <span className="text-secondary">[]</span>
          {trailingComma ? <span className="text-faint">,</span> : null}
        </div>
      );
    }

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full text-left font-mono text-[12px] leading-6 hover:bg-surface rounded transition-colors"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <span className="text-faint mr-1">{open ? "▾" : "▸"}</span>
          {keyPrefix}
          <span className="text-secondary">[</span>
          {!open ? <span className="text-faint"> ... ]</span> : null}
          {!open && trailingComma ? <span className="text-faint">,</span> : null}
        </button>

        {open && (
          <>
            {value.map((item, idx) => (
              <CollapsibleFormattedNode
                key={`${depth}-arr-${idx}`}
                value={item}
                depth={depth + 1}
                trailingComma={idx < value.length - 1}
              />
            ))}
            <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 16}px` }}>
              <span className="text-secondary">]</span>
              {trailingComma ? <span className="text-faint">,</span> : null}
            </div>
          </>
        )}
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, JsonValue>);
  if (entries.length === 0) {
    return (
      <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyPrefix}
        <span className="text-secondary">{}</span>
        {trailingComma ? <span className="text-faint">,</span> : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left font-mono text-[12px] leading-6 hover:bg-surface rounded transition-colors"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <span className="text-faint mr-1">{open ? "▾" : "▸"}</span>
        {keyPrefix}
        <span className="text-secondary">{"{"}</span>
        {!open ? <span className="text-faint"> ... {"}"}</span> : null}
        {!open && trailingComma ? <span className="text-faint">,</span> : null}
      </button>

      {open && (
        <>
          {entries.map(([k, v], idx) => (
            <CollapsibleFormattedNode
              key={`${depth}-obj-${k}`}
              name={k}
              value={v}
              depth={depth + 1}
              trailingComma={idx < entries.length - 1}
            />
          ))}
          <div className="font-mono text-[12px] leading-6" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="text-secondary">{"}"}</span>
            {trailingComma ? <span className="text-faint">,</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonViewerPage() {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [parsed, setParsed] = useState<JsonValue | null>(null);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ViewerTab>("text");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textMode, setTextMode] = useState<"edit" | "formatted">("edit");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      document.body.style.overflow = "";
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  function parseJson(silent = false): JsonValue | null {
    try {
      const value = JSON.parse(input) as JsonValue;
      setParsed(value);
      setError("");
      return value;
    } catch (err) {
      setParsed(null);
      if (!silent) {
        setError(err instanceof Error ? err.message : "Invalid JSON");
      }
      return null;
    }
  }

  function formatJson() {
    const value = parseJson();
    if (!value) return;
    setInput(JSON.stringify(value, null, 2));
    setTextMode("formatted");
  }

  function openTreeTab() {
    setActiveTab("tree");
    parseJson();
  }

  function clearAll() {
    setInput("");
    setParsed(null);
    setError("");
    setActiveTab("text");
    setTextMode("edit");
  }

  async function copyCurrent() {
    if (activeTab === "text") {
      await navigator.clipboard.writeText(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      return;
    }

    const value = parsed || parseJson(true);
    if (!value) return;
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const workspace = (
    <div className="rounded-2xl bg-surface border border-subtle overflow-hidden">
      <div className="px-5 py-3.5 border-b border-subtle flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-default">
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1",
              activeTab === "text" ? "bg-surface-3 text-primary" : "text-secondary hover:text-primary"
            )}
          >
            <Braces size={11} />
            Text
          </button>
          <button
            type="button"
            onClick={openTreeTab}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1",
              activeTab === "tree" ? "bg-surface-3 text-primary" : "text-secondary hover:text-primary"
            )}
          >
            <GitBranch size={11} />
            Tree
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeTab === "text" && (
            <Button variant="primary" size="sm" icon={<CheckCircle2 size={12} />} onClick={formatJson}>
              Format JSON
            </Button>
          )}
          {activeTab === "text" && textMode === "formatted" && (
            <Button variant="outline" size="sm" onClick={() => setTextMode("edit")}>
              Edit JSON
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<Trash2 size={12} />} onClick={clearAll}>
            Clear
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
            onClick={copyCurrent}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="px-5 py-2 border-b border-subtle flex items-center gap-2">
        {error ? (
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={12} />
            {error}
          </div>
        ) : parsed ? (
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 size={12} />
            Valid JSON
          </div>
        ) : (
          <div className="text-[11px] text-muted">Paste JSON to begin</div>
        )}
      </div>

      <div className="p-4 overflow-auto bg-surface-2" style={{ height: isFullscreen ? "calc(100vh - 210px)" : "620px" }}>
        {activeTab === "text" ? (
          textMode === "formatted" && parsed ? (
            <div className="h-full w-full rounded-xl border border-subtle bg-surface p-3 overflow-auto">
              <CollapsibleFormattedNode value={parsed} />
            </div>
          ) : (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-full rounded-xl border border-subtle bg-surface p-4 font-mono text-[12px] leading-6 text-primary outline-none focus:border-default transition-colors"
              placeholder="Paste JSON here..."
            />
          )
        ) : !parsed ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <GitBranch size={22} className="text-faint mb-2" />
            <p className="text-[13px] text-muted">No valid JSON to render as tree.</p>
            <p className="text-[11px] text-faint mt-1">Go to Text tab and click Format JSON first.</p>
          </div>
        ) : (
          <JsonTreeNode value={parsed} />
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-13">
      <TopBar title="JSON Viewer" description="Work with large JSON using Text and Tree tabs" />

      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="JSON Viewer" description="Use Text tab to edit/format JSON and Tree tab to inspect structure">
          <div className="flex items-center gap-2">
            <Badge variant="info" dot>Utilities</Badge>
            <Button
              variant="outline"
              size="sm"
              icon={isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              onClick={() => setIsFullscreen((prev) => !prev)}
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </PageHeader>
        {workspace}
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-base/95 backdrop-blur-sm overflow-auto overscroll-contain pt-4 pb-4 px-4">
          <div className="mx-auto" style={{ maxWidth: "1600px" }}>
            <div className="flex items-center justify-end mb-3">
              <Button variant="outline" size="sm" icon={<Minimize2 size={12} />} onClick={() => setIsFullscreen(false)}>
                Exit Fullscreen
              </Button>
            </div>
            {workspace}
          </div>
        </div>
      )}
    </div>
  );
}

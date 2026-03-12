"use client";

import { useState, useCallback, useEffect, use } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDuration } from "@/lib/utils";
import {
  Play,
  Plus,
  X,
  Database,
  ChevronRight,
  ChevronDown,
  Table2,
  Hash,
  Clock,
  ArrowLeft,
  Download,
  Copy,
  CheckCheck,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DataExplorer } from "@/components/database/DataExplorer";

interface Column {
  name: string;
  type: string;
  primary: boolean;
  nullable: boolean;
}

interface Table {
  name: string;
  columns: Column[];
}

interface QueryResult {
  fields: { name: string }[];
  rows: any[];
  rowCount: number;
  duration: number;
  error?: string;
}

interface HistoryItem {
  id: string;
  query: string;
  duration_ms: number | null;
  created_at: string;
  status: string;
}

// ─── Components ────────────────────────────────────────────────────────────────

function SchemaTree({ schema, loading, onOpenData }: { schema: Table[], loading: boolean, onOpenData: (tableName: string) => void }) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (name: string) => {
    setExpanded((e) => (e.includes(name) ? e.filter((n) => n !== name) : [...e, name]));
  };

  if (loading) {
    return <div className="p-4 text-center text-[#8a8a8a] text-[12px]"><Spinner size={16} /></div>;
  }

  return (
    <div className="text-[12px]">
      <div className="mb-2 px-3 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#444] font-medium">
        <Hash size={10} />
        Tables
      </div>
      {schema.length === 0 ? (
        <div className="px-4 py-2 text-[#666] text-[11px]">No tables found</div>
      ) : (
        schema.map((table) => (
          <div key={table.name} className="group">
            <div
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#161616] transition-colors cursor-pointer"
              onClick={() => toggle(table.name)}
            >
              {expanded.includes(table.name) ? (
                <ChevronDown size={11} className="text-[#444] shrink-0" />
              ) : (
                <ChevronRight size={11} className="text-[#444] shrink-0" />
              )}
              <Table2 size={12} className="text-amber-400/70 shrink-0" />
              <span className="text-[#8a8a8a] group-hover:text-[#f0f0f0] transition-colors font-mono">{table.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenData(table.name); }}
                className="ml-auto opacity-0 group-hover:opacity-100 text-[#444] hover:text-amber-400 transition-colors"
                title="View Data"
              >
                <Table2 size={12} />
              </button>
            </div>
            {expanded.includes(table.name) && (
              <div className="pl-8 pb-1">
                {table.columns.map((col) => (
                  <div key={col.name} className="flex items-center gap-2 py-1 px-2 hover:bg-[#161616] transition-colors rounded">
                    {col.primary && (
                      <span className="text-[9px] font-bold text-amber-400/80 bg-amber-400/10 px-1 rounded">PK</span>
                    )}
                    <span className="text-[#8a8a8a] font-mono">{col.name}</span>
                    <span className="text-[10px] text-[#444] font-mono ml-auto">{col.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function QueryHistory({ history, loading, onSelect }: { history: HistoryItem[], loading: boolean, onSelect: (sql: string) => void }) {
  if (loading) {
    return <div className="p-4 text-center text-[#8a8a8a] text-[12px]"><Spinner size={16} /></div>;
  }

  return (
    <div className="text-[12px]">
      <div className="mb-2 px-3 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#444] font-medium">
        <Clock size={10} />
        Recent
      </div>
      {history.length === 0 ? (
        <div className="px-4 py-2 text-[#666] text-[11px]">No history found</div>
      ) : (
        history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.query)}
            className="w-full text-left px-3 py-2.5 hover:bg-[#161616] transition-colors border-b border-[#141414] last:border-0"
          >
            <p className="text-[11px] text-[#8a8a8a] font-mono truncate">{item.query}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={item.status === 'error' ? 'text-red-400 text-[10px]' : 'text-green-400 text-[10px]'}>
                 {item.status}
              </span>
              {item.duration_ms !== null && <span className="text-[10px] text-[#444]">{item.duration_ms}ms</span>}
              <span className="text-[10px] text-[#444] ml-auto">{new Date(item.created_at).toLocaleTimeString()}</span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: QueryResult | null }) {
  const [copied, setCopied] = useState(false);

  if (!results) {
    return (
      <div className="flex items-center justify-center h-full text-[#444] text-[13px]">
        Run a query to see results
      </div>
    );
  }

  if (results.error) {
    return (
      <div className="flex flex-col gap-2 p-4 text-red-400 font-mono text-[13px] bg-red-950/10 h-full overflow-auto">
         <div className="flex items-center gap-2"><AlertCircle size={14} /> Error</div>
         <p>{results.error}</p>
      </div>
    );
  }

  const handleCopy = () => {
    const csv = [
      results.fields.map((f) => f.name).join(","),
      ...results.rows.map((row) => Object.values(row).join(",")),
    ].join("\n");
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="flex items-center gap-3">
          <Badge variant="success" dot>{results.rowCount} rows</Badge>
          <span className="text-[11px] text-[#444]">{formatDuration(results.duration)}</span>
        </div>
        {results.rows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={copied ? <CheckCheck size={12} /> : <Copy size={12} />} onClick={handleCopy}>
              {copied ? "Copied!" : "Copy CSV"}
            </Button>
            <Button variant="ghost" size="sm" icon={<Download size={12} />}>
              Export
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {results.rows.length === 0 ? (
           <div className="p-4 text-[#8a8a8a] text-[12px]">Query returned empty result set.</div>
        ) : (
          <table className="w-full text-[12px] border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#1a1a1a]">
                {results.fields.map((field) => (
                  <th
                    key={field.name}
                    className="px-4 py-2 text-left text-[11px] font-medium text-[#8a8a8a] bg-[#0f0f0f] border-r border-[#141414] last:border-0 whitespace-nowrap uppercase tracking-wider"
                  >
                    {field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[#141414] hover:bg-[#111] transition-colors"
                >
                  {results.fields.map((field) => {
                    const val = row[field.name];
                    return (
                      <td
                        key={field.name}
                        className="px-4 py-2 font-mono text-[#f0f0f0] border-r border-[#141414] last:border-0 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {val === null || val === undefined ? (
                           <span className="text-[#555] italic">null</span>
                        ) : typeof val === "boolean" ? (
                           <span className={val ? "text-green-400" : "text-red-400"}>{String(val)}</span>
                        ) : typeof val === "object" ? (
                           <span className="text-[#888]">{JSON.stringify(val)}</span>
                        ) : (
                           String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Editor Tabs ────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  type: "query" | "table";
  label: string;
  sql?: string;
  tableName?: string;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DatabaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, org } = useAuth();
  
  const [dbName, setDbName] = useState("Loading...");
  const [dbType, setDbType] = useState("");
  
  const [leftTab, setLeftTab] = useState<"schema" | "history">("schema");
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "tab1", type: "query", label: "Query 1", sql: "" },
  ]);
  const [activeTab, setActiveTab] = useState("tab1");
  const [running, setRunning] = useState(false);
  
  const [schema, setSchema] = useState<Table[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  const [results, setResults] = useState<QueryResult | null>(null);

  const activeTabData = tabs.find((t) => t.id === activeTab);

  const supabase = createClient();

  useEffect(() => {
     async function init() {
        if (!org || !id) return;
        
        // Fetch DB info
        const { data: dbData } = await supabase.from("database_connections").select("name, type").eq("id", id).single();
        if (dbData) {
           setDbName(dbData.name);
           setDbType(dbData.type);
        }

        // Fetch Schema
        fetch(`/api/connections/${id}/schema`)
          .then(res => res.json())
          .then(data => {
             if (data.tables) setSchema(data.tables);
             setSchemaLoading(false);
          })
          .catch(err => {
             console.error("Schema fetch err", err);
             setSchemaLoading(false);
          });

        loadHistory();
     }
     init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, id]);

  async function loadHistory() {
     setHistoryLoading(true);
     const { data } = await supabase.from("activity_logs")
       .select("*")
       .eq("org_id", org?.id)
       .eq("resource", id)
       .in("action", ["query", "read", "update", "insert", "delete", "explorer"])
       .order("created_at", { ascending: false })
       .limit(20);
       
     if (data) {
        setHistory(data as HistoryItem[]);
     }
     setHistoryLoading(false);
  }

  const addTab = () => {
    const newTab: Tab = { id: `tab${Date.now()}`, type: "query", label: `Query ${tabs.filter(t => t.type === "query").length + 1}`, sql: "" };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const openTableData = (tableName: string) => {
    const existing = tabs.find(t => t.type === "table" && t.tableName === tableName);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }
    const newTab: Tab = { id: `tab${Date.now()}`, type: "table", label: tableName, tableName };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) setActiveTab(newTabs[newTabs.length - 1].id);
  };

  const updateSql = useCallback((sql: string) => {
    setTabs((prev) => prev.map((t) => (t.id === activeTab ? { ...t, sql } : t)));
  }, [activeTab]);

  const runQuery = async () => {
    if (!activeTabData?.sql?.trim()) return;
    setRunning(true);
    setResults(null);
    
    try {
      const res = await fetch(`/api/connections/${id}/query`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ sql: activeTabData.sql })
      });
      const data = await res.json();
      
      const queryStatus = res.ok ? "success" : "error";
      
      if (res.ok) {
         setResults(data);
      } else {
         setResults({ error: data.error, fields: [], rows: [], rowCount: 0, duration: 0 });
      }
      
      // Log activity
      if (org && user) {
         await supabase.from("activity_logs").insert({
            org_id: org.id,
            user_id: user.id,
            user_email: user.email,
            action: "query",
            resource: id,
            query: activeTabData.sql || "",
            status: queryStatus,
            duration_ms: data.duration || 0
         });
         loadHistory();
      }

    } catch (err: any) {
       setResults({ error: err.message, fields: [], rows: [], rowCount: 0, duration: 0 });
    }
    
    setRunning(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#080808]">
      <TopBar
        title={dbName}
        description={dbType}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/databases">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={12} />}>Back</Button>
            </Link>
            <Badge variant="success" dot>connected</Badge>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden pt-[52px]">
        {/* Left panel — schema / history */}
        <div className="w-[240px] shrink-0 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Tab switcher */}
          <div className="flex items-center border-b border-[#141414]">
            {(["schema", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2.5 text-[12px] font-medium capitalize transition-colors ${
                  leftTab === tab
                    ? "text-amber-400 border-b-2 border-amber-500"
                    : "text-[#444] hover:text-[#8a8a8a]"
                }`}
              >
                {tab === "schema" ? (
                  <span className="flex items-center justify-center gap-1.5"><Database size={11} />Schema</span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Clock size={11} />History</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {leftTab === "schema" ? (
              <SchemaTree schema={schema} loading={schemaLoading} onOpenData={openTableData} />
            ) : (
              <QueryHistory history={history} loading={historyLoading} onSelect={(sql) => updateSql(sql)} />
            )}
          </div>
        </div>

        {/* Main workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor tabs bar */}
          <div className="flex items-center bg-[#0a0a0a] border-b border-[#141414] h-10 overflow-x-auto shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 h-full text-[12px] font-medium border-r border-[#141414] shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#0f0f0f] text-[#f0f0f0] border-t-2 border-t-amber-500"
                    : "text-[#444] hover:text-[#8a8a8a] hover:bg-[#0f0f0f]"
                }`}
              >
                {tab.label}
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => closeTab(tab.id, e)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={addTab}
              className="flex items-center justify-center w-8 h-full text-[#444] hover:text-[#8a8a8a] hover:bg-[#0f0f0f] transition-colors shrink-0"
            >
              <Plus size={13} />
            </button>

            {/* Run button */}
            {activeTabData?.type === "query" && (
              <div className="ml-auto flex items-center gap-2 px-3">
                <Button
                  variant="primary"
                  size="sm"
                  icon={running ? <Spinner size={12} /> : <Play size={12} />}
                  onClick={runQuery}
                  disabled={running}
                >
                  {running ? "Running…" : "Run"}
                  {!running && (
                    <kbd className="ml-1 text-[10px] bg-amber-600/30 px-1 rounded font-mono">⌘↵</kbd>
                  )}
                </Button>
              </div>
            )}
          </div>

          {activeTabData?.type === "table" ? (
            <div className="flex-1 overflow-hidden bg-[#080808]">
               <DataExplorer 
                 connectionId={id} 
                 tableName={activeTabData.tableName!} 
                 columns={schema.find(s => s.name === activeTabData.tableName)?.columns || []} 
                 onLogActivity={async (action, sql, duration, status) => {
                   if (org && user) {
                     await supabase.from("activity_logs").insert({
                        org_id: org.id,
                        user_id: user.id,
                        user_email: user.email,
                        action: action, // "read", "update", "insert", "delete"
                        resource: id,
                        query: sql,
                        status: status,
                        duration_ms: duration
                     });
                     loadHistory();
                   }
                 }}
               />
            </div>
          ) : (
            <>
              {/* SQL Editor area */}
              <div
                className={`bg-[#0f0f0f] shrink-0 overflow-auto font-mono text-[13px] leading-6 text-[#f0f0f0] ${
                  results ? "h-[45%]" : "h-full"
                }`}
              >
                <div className="flex h-full min-h-full">
                  {/* Line numbers */}
                  <div className="w-10 shrink-0 bg-[#0d0d0d] border-r border-[#141414] pt-3 pb-3 text-right pr-2.5 text-[#333] text-[12px] select-none overflow-hidden">
                    {(activeTabData?.sql?.split("\n") || [""]).map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={activeTabData?.sql || ""}
                    onChange={(e) => updateSql(e.target.value)}
                    className="flex-1 bg-transparent px-4 pt-3 pb-3 text-[13px] font-mono text-[#f0f0f0] resize-none outline-none h-full min-h-[300px]"
                    spellCheck={false}
                    placeholder="-- Write your SQL query here..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        runQuery();
                      }
                      // Tab key inserts spaces
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        const newSql =
                          (activeTabData?.sql || "").substring(0, start) + "  " + (activeTabData?.sql || "").substring(end);
                        updateSql(newSql);
                        setTimeout(() => {
                          if (e.currentTarget) {
                            e.currentTarget.selectionStart = start + 2;
                            e.currentTarget.selectionEnd = start + 2;
                          }
                        }, 0);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Results panel */}
              {results && (
                <div className="flex-[2] overflow-hidden bg-[#080808] border-t border-[#1a1a1a]">
                  <ResultsTable results={results} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState, useCallback, useEffect, use, useMemo, useRef } from "react";
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
  AlertCircle,
  Activity,
  HeartPulse,
  ShieldCheck,
  Network,
  TableProperties,
  Link2,
  Maximize2,
  Minimize2
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

interface HealthData {
  status: "healthy" | "degraded" | "down";
  latencyMs: number | null;
  engine?: string;
  version?: string | null;
  database?: string | null;
  tableCount?: number;
  columnCount?: number;
  error?: string;
}

interface RelationEdge {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

// ─── Components ────────────────────────────────────────────────────────────────

function SchemaTree({ schema, loading, onOpenData }: { schema: Table[], loading: boolean, onOpenData: (tableName: string) => void }) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (name: string) => {
    setExpanded((e) => (e.includes(name) ? e.filter((n) => n !== name) : [...e, name]));
  };

  if (loading) {
    return <div className="p-4 text-center text-secondary text-[12px]"><Spinner size={16} /></div>;
  }

  return (
    <div className="text-[12px]">
      <div className="mb-2 px-3 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted font-medium">
        <Hash size={10} />
        Tables
      </div>
      {schema.length === 0 ? (
        <div className="px-4 py-2 text-secondary text-[11px]">No tables found</div>
      ) : (
        schema.map((table) => (
          <div key={table.name} className="group">
            <div
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-3 transition-colors cursor-pointer"
              onClick={() => toggle(table.name)}
            >
              {expanded.includes(table.name) ? (
                <ChevronDown size={11} className="text-muted shrink-0" />
              ) : (
                <ChevronRight size={11} className="text-muted shrink-0" />
              )}
              <Table2 size={12} className="text-amber-400/70 shrink-0" />
              <span className="text-secondary group-hover:text-primary transition-colors font-mono">{table.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenData(table.name); }}
                className="ml-auto opacity-0 group-hover:opacity-100 text-muted hover:text-amber-400 transition-colors"
                title="View Data"
              >
                <Table2 size={12} />
              </button>
            </div>
            {expanded.includes(table.name) && (
              <div className="pl-8 pb-1">
                {table.columns.map((col) => (
                  <div key={col.name} className="flex items-center gap-2 py-1 px-2 hover:bg-surface-3 transition-colors rounded">
                    {col.primary && (
                      <span className="text-[9px] font-bold text-amber-400/80 bg-amber-400/10 px-1 rounded">PK</span>
                    )}
                    <span className="text-secondary font-mono">{col.name}</span>
                    <span className="text-[10px] text-muted font-mono ml-auto">{col.type}</span>
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
    return <div className="p-4 text-center text-secondary text-[12px]"><Spinner size={16} /></div>;
  }

  return (
    <div className="text-[12px]">
      <div className="mb-2 px-3 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted font-medium">
        <Clock size={10} />
        Recent
      </div>
      {history.length === 0 ? (
        <div className="px-4 py-2 text-secondary text-[11px]">No history found</div>
      ) : (
        history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.query)}
            className="w-full text-left px-3 py-2.5 hover:bg-surface-3 transition-colors border-b border-subtle last:border-0"
          >
            <p className="text-[11px] text-secondary font-mono truncate">{item.query}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={item.status === 'error' ? 'text-red-400 text-[10px]' : 'text-green-400 text-[10px]'}>
                 {item.status}
              </span>
              {item.duration_ms !== null && <span className="text-[10px] text-muted">{item.duration_ms}ms</span>}
              <span className="text-[10px] text-muted ml-auto">{new Date(item.created_at).toLocaleTimeString()}</span>
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
      <div className="flex items-center justify-center h-full text-muted text-[13px]">
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-subtle bg-surface">
        <div className="flex items-center gap-3">
          <Badge variant="success" dot>{results.rowCount} rows</Badge>
          <span className="text-[11px] text-muted">{formatDuration(results.duration)}</span>
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
           <div className="p-4 text-secondary text-[12px]">Query returned empty result set.</div>
        ) : (
          <table className="w-full text-[12px] border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-subtle">
                {results.fields.map((field) => (
                  <th
                    key={field.name}
                    className="px-4 py-2 text-left text-[11px] font-medium text-secondary bg-surface border-r border-subtle last:border-0 whitespace-nowrap uppercase tracking-wider"
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
                  className="border-b border-subtle hover:bg-surface-2 transition-colors"
                >
                  {results.fields.map((field) => {
                    const val = row[field.name];
                    return (
                      <td
                        key={field.name}
                        className="px-4 py-2 font-mono text-primary border-r border-subtle last:border-0 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {val === null || val === undefined ? (
                           <span className="text-muted italic">null</span>
                        ) : typeof val === "boolean" ? (
                           <span className={val ? "text-green-400" : "text-red-400"}>{String(val)}</span>
                        ) : typeof val === "object" ? (
                           <span className="text-muted">{JSON.stringify(val)}</span>
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
  type: "query" | "table" | "overview";
  label: string;
  sql?: string;
  tableName?: string;
}

function inferRelations(schema: Table[]): RelationEdge[] {
  const tableSet = new Set(schema.map((t) => t.name.toLowerCase()));
  const edges: RelationEdge[] = [];

  for (const table of schema) {
    for (const col of table.columns) {
      if (!col.name.endsWith("_id") || col.primary) continue;
      const base = col.name.replace(/_id$/, "").toLowerCase();
      const candidates = [base, `${base}s`, `${base}es`, `${base}ies`];
      const target = candidates.find((c) => tableSet.has(c));
      if (!target) continue;
      edges.push({ fromTable: table.name, fromColumn: col.name, toTable: target, toColumn: "id" });
    }
  }

  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.fromTable}.${e.fromColumn}->${e.toTable}.${e.toColumn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DatabaseOverview({
  dbName,
  dbType,
  schema,
  schemaLoading,
  history,
  health,
  healthLoading,
}: {
  dbName: string;
  dbType: string;
  schema: Table[];
  schemaLoading: boolean;
  history: HistoryItem[];
  health: HealthData | null;
  healthLoading: boolean;
}) {
  const relations = inferRelations(schema);
  const totalColumns = schema.reduce((sum, t) => sum + t.columns.length, 0);
  const queryCount = history.length;
  const errorCount = history.filter((h) => h.status === "error").length;
  const latestActivity = history[0]?.created_at;
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const diagram = useMemo(() => {
    const nodePadding = 24;
    const colGap = 100;
    const rowGap = 26;
    const laneGap = 72;
    const componentGapX = 120;
    const componentGapY = 96;
    const maxComponentRowWidth = 1800;
    const edgePalette = ["#38bdf8", "#f59e0b", "#22c55e", "#f97316", "#a78bfa", "#06b6d4", "#ef4444", "#84cc16"];

    function hexToRgba(hex: string, alpha: number) {
      const normalized = hex.replace("#", "");
      const bigint = Number.parseInt(normalized, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function estimateNodeWidth(table: Table) {
      const displayed = table.columns;
      const maxName = Math.max(table.name.length, ...displayed.map((c) => c.name.length));
      const maxType = Math.max(4, ...displayed.map((c) => c.type.length));
      return Math.max(280, Math.min(760, 120 + maxName * 7 + maxType * 6));
    }

    type NodeLayout = {
      table: Table;
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const nodeMeta = schema.map((table) => {
      const width = estimateNodeWidth(table);
      const height = 34 + table.columns.length * 18 + 16;
      return { table, key: table.name.toLowerCase(), width, height };
    });

    const metaMap = new Map(nodeMeta.map((n) => [n.key, n] as const));
    const tableSet = new Set(nodeMeta.map((n) => n.key));

    const dependencies = new Map<string, string[]>();
    const undirected = new Map<string, Set<string>>();
    for (const n of nodeMeta) {
      dependencies.set(n.key, []);
      undirected.set(n.key, new Set());
    }

    for (const rel of relations) {
      const from = rel.fromTable.toLowerCase();
      const to = rel.toTable.toLowerCase();
      if (!tableSet.has(from) || !tableSet.has(to)) continue;
      dependencies.set(from, [...(dependencies.get(from) || []), to]);
      undirected.get(from)?.add(to);
      undirected.get(to)?.add(from);
    }

    const components: string[][] = [];
    const visited = new Set<string>();
    for (const key of tableSet) {
      if (visited.has(key)) continue;
      const stack = [key];
      visited.add(key);
      const component: string[] = [];

      while (stack.length > 0) {
        const cur = stack.pop()!;
        component.push(cur);
        for (const next of undirected.get(cur) || []) {
          if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
      }

      components.push(component);
    }

    components.sort((a, b) => b.length - a.length);

    type ComponentLayout = {
      keys: string[];
      width: number;
      height: number;
      nodes: Array<Omit<NodeLayout, "x" | "y"> & { localX: number; localY: number }>;
    };

    const componentLayouts: ComponentLayout[] = components.map((componentKeys) => {
      const componentSet = new Set(componentKeys);
      const levelMemo = new Map<string, number>();
      const visiting = new Set<string>();

      function getLevel(name: string): number {
        const cached = levelMemo.get(name);
        if (cached != null) return cached;
        if (visiting.has(name)) return 0;

        visiting.add(name);
        const deps = (dependencies.get(name) || []).filter((d) => componentSet.has(d));
        const nextLevel = deps.length === 0 ? 0 : Math.max(...deps.map((d) => getLevel(d) + 1));
        visiting.delete(name);
        levelMemo.set(name, nextLevel);
        return nextLevel;
      }

      const byLevel = new Map<number, string[]>();
      let maxLevel = 0;
      for (const key of componentKeys) {
        const level = getLevel(key);
        maxLevel = Math.max(maxLevel, level);
        byLevel.set(level, [...(byLevel.get(level) || []), key]);
      }

      const componentNodeWidth = Math.max(...componentKeys.map((k) => metaMap.get(k)?.width || 260));
      const positionY = new Map<string, number>();
      let componentHeight = 0;

      for (let level = 0; level <= maxLevel; level++) {
        const names = [...(byLevel.get(level) || [])];
        names.sort((a, b) => {
          const depsA = (dependencies.get(a) || []).filter((d) => componentSet.has(d));
          const depsB = (dependencies.get(b) || []).filter((d) => componentSet.has(d));
          const avgA = depsA.length > 0 ? depsA.reduce((sum, d) => sum + (positionY.get(d) || 0), 0) / depsA.length : Number.POSITIVE_INFINITY;
          const avgB = depsB.length > 0 ? depsB.reduce((sum, d) => sum + (positionY.get(d) || 0), 0) / depsB.length : Number.POSITIVE_INFINITY;
          if (avgA !== avgB) return avgA - avgB;
          return a.localeCompare(b);
        });

        let yCursor = nodePadding;
        for (const name of names) {
          const meta = metaMap.get(name);
          if (!meta) continue;
          positionY.set(name, yCursor);
          yCursor += meta.height + rowGap;
        }

        componentHeight = Math.max(componentHeight, yCursor + nodePadding);
        byLevel.set(level, names);
      }

      const nodes = componentKeys.map((key) => {
        const meta = metaMap.get(key)!;
        const level = getLevel(key);
        return {
          table: meta.table,
          key,
          width: meta.width,
          height: meta.height,
          localX: nodePadding + level * (componentNodeWidth + colGap),
          localY: positionY.get(key) || nodePadding,
        };
      });

      const width = Math.max(460, nodePadding * 2 + (maxLevel + 1) * componentNodeWidth + maxLevel * colGap);
      const height = Math.max(320, componentHeight + laneGap);

      return { keys: componentKeys, width, height, nodes };
    });

    const nodes: NodeLayout[] = [];
    const nodeMap = new Map<string, NodeLayout>();
    let cursorX = nodePadding;
    let cursorY = nodePadding;
    let rowMaxHeight = 0;
    let diagramWidth = 920;

    for (const comp of componentLayouts) {
      if (cursorX !== nodePadding && cursorX + comp.width > maxComponentRowWidth) {
        cursorX = nodePadding;
        cursorY += rowMaxHeight + componentGapY;
        rowMaxHeight = 0;
      }

      for (const local of comp.nodes) {
        const node = {
          table: local.table,
          key: local.key,
          x: cursorX + local.localX,
          y: cursorY + local.localY,
          width: local.width,
          height: local.height,
        };
        nodes.push(node);
        nodeMap.set(node.key, node);
      }

      diagramWidth = Math.max(diagramWidth, cursorX + comp.width + nodePadding);
      rowMaxHeight = Math.max(rowMaxHeight, comp.height);
      cursorX += comp.width + componentGapX;
    }

    const diagramHeight = Math.max(520, cursorY + rowMaxHeight + nodePadding);

    function laneOffset(index: number) {
      if (index === 0) return 0;
      const step = Math.ceil(index / 2) * 10;
      return index % 2 === 1 ? step : -step;
    }

    function toFluidPath(points: Array<{ x: number; y: number }>) {
      if (points.length <= 1) return "";
      if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} C ${(points[0].x + points[1].x) / 2} ${points[0].y}, ${(points[0].x + points[1].x) / 2} ${points[1].y}, ${points[1].x} ${points[1].y}`;
      }

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
      }
      const last = points[points.length - 1];
      d += ` T ${last.x} ${last.y}`;
      return d;
    }

    const laneUsage = new Map<string, number>();

    const rawEdges = relations
      .map((rel, relIdx) => {
        const from = nodeMap.get(rel.fromTable.toLowerCase());
        const to = nodeMap.get(rel.toTable.toLowerCase());
        if (!from || !to) return null;

        const fromTop = from.y;
        const fromBottom = from.y + from.height;
        const toTop = to.y;
        const toBottom = to.y + to.height;
        const fromMidX = from.x + from.width / 2;
        const toMidX = to.x + to.width / 2;

        let points: Array<{ x: number; y: number }> = [];
        let labelX = 0;
        let labelY = 0;

        if (fromBottom + 8 <= toTop) {
          const start = { x: fromMidX, y: fromBottom };
          const end = { x: toMidX, y: toTop };
          const baseMidY = (start.y + end.y) / 2;
          const laneKey = `v:${Math.round(baseMidY / 8)}:${Math.round(Math.min(start.x, end.x) / 32)}:${Math.round(Math.max(start.x, end.x) / 32)}`;
          const lane = laneUsage.get(laneKey) || 0;
          laneUsage.set(laneKey, lane + 1);
          const midY = baseMidY + laneOffset(lane);
          points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
          labelX = (start.x + end.x) / 2;
          labelY = midY - 6;
        } else if (toBottom + 8 <= fromTop) {
          const start = { x: fromMidX, y: fromTop };
          const end = { x: toMidX, y: toBottom };
          const baseMidY = (start.y + end.y) / 2;
          const laneKey = `v:${Math.round(baseMidY / 8)}:${Math.round(Math.min(start.x, end.x) / 32)}:${Math.round(Math.max(start.x, end.x) / 32)}`;
          const lane = laneUsage.get(laneKey) || 0;
          laneUsage.set(laneKey, lane + 1);
          const midY = baseMidY + laneOffset(lane);
          points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
          labelX = (start.x + end.x) / 2;
          labelY = midY - 6;
        } else {
          const routeAboveYBase = Math.min(fromTop, toTop) - 22;
          const routeBelowYBase = Math.max(fromBottom, toBottom) + 22;
          const costAbove = Math.abs(fromTop - routeAboveYBase) + Math.abs(toTop - routeAboveYBase);
          const costBelow = Math.abs(routeBelowYBase - fromBottom) + Math.abs(routeBelowYBase - toBottom);
          const useAbove = costAbove <= costBelow;

          const start = { x: fromMidX, y: useAbove ? fromTop : fromBottom };
          const end = { x: toMidX, y: useAbove ? toTop : toBottom };
          const baseRouteY = useAbove ? routeAboveYBase : routeBelowYBase;
          const laneKey = `h:${Math.round(baseRouteY / 8)}:${Math.round(Math.min(start.x, end.x) / 32)}:${Math.round(Math.max(start.x, end.x) / 32)}`;
          const lane = laneUsage.get(laneKey) || 0;
          laneUsage.set(laneKey, lane + 1);
          const routeY = baseRouteY + laneOffset(lane);

          points = [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end];
          labelX = (start.x + end.x) / 2;
          labelY = routeY - 6;
        }

        const path = toFluidPath(points);
        const color = edgePalette[relIdx % edgePalette.length];
        const labelWidth = Math.max(70, Math.min(260, rel.fromColumn.length * 7 + 18));

        return {
          rel,
          path,
          labelX,
          labelY,
          color,
          labelFill: hexToRgba(color, 0.18),
          labelStroke: hexToRgba(color, 0.45),
          labelText: hexToRgba(color, 0.95),
          labelWidth,
          labelHeight: 18,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const placedLabels: Array<{ x: number; y: number; halfW: number; halfH: number }> = [];
    const labelPad = 4;

    const edges = rawEdges.map((edge) => {
      const halfW = edge.labelWidth / 2;
      const halfH = edge.labelHeight / 2;

      let x = Math.max(halfW + labelPad, Math.min(diagramWidth - halfW - labelPad, edge.labelX));
      let y = Math.max(halfH + labelPad, Math.min(diagramHeight - halfH - labelPad, edge.labelY));

      let tries = 0;
      while (tries < 14) {
        const collision = placedLabels.find(
          (p) => Math.abs(p.x - x) < p.halfW + halfW + 4 && Math.abs(p.y - y) < p.halfH + halfH + 2
        );
        if (!collision) break;

        const direction = tries % 2 === 0 ? 1 : -1;
        const step = 12 + Math.floor(tries / 2) * 4;
        y = Math.max(halfH + labelPad, Math.min(diagramHeight - halfH - labelPad, y + direction * step));
        x = Math.max(halfW + labelPad, Math.min(diagramWidth - halfW - labelPad, x + direction * 6));
        tries += 1;
      }

      placedLabels.push({ x, y, halfW, halfH });
      return { ...edge, labelX: x, labelY: y };
    });

    return { nodes, edges, width: diagramWidth, height: diagramHeight };
  }, [schema, relations]);

  useEffect(() => {
    if (!diagramFullscreen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDiagramFullscreen(false);
      }
    }

    window.addEventListener("keydown", onKeydown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeydown);
    };
  }, [diagramFullscreen]);

  function downloadDiagramSvg() {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dbName || "database"}-er-diagram.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderDiagramCanvas() {
    return (
      <div className="rounded-lg border border-subtle bg-surface-2 p-3 overflow-auto h-full">
        <div
          style={{
            width: `${diagram.width * diagramZoom}px`,
            height: `${diagram.height * diagramZoom}px`,
          }}
        >
          <svg
            ref={svgRef}
            width={diagram.width}
            height={diagram.height}
            viewBox={`0 0 ${diagram.width} ${diagram.height}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: `scale(${diagramZoom})`, transformOrigin: "top left" }}
          >
            <defs>
              <pattern id="erGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
              </pattern>
              <marker id="erArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L7,3.5 L0,7 z" fill="context-stroke" />
              </marker>
            </defs>

            <rect x="0" y="0" width={diagram.width} height={diagram.height} fill="url(#erGrid)" />

            {diagram.edges.map((edge, idx) => (
              <g key={`edge-${idx}`}>
                <path
                  d={edge.path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#erArrow)"
                />
                <rect
                  x={edge.labelX - edge.labelWidth / 2}
                  y={edge.labelY - edge.labelHeight / 2}
                  width={edge.labelWidth}
                  height={edge.labelHeight}
                  rx="6"
                  fill={edge.labelFill}
                  stroke={edge.labelStroke}
                />
                <text x={edge.labelX} y={edge.labelY + 3} textAnchor="middle" fontSize="10" fill={edge.labelText} fontFamily="JetBrains Mono, monospace">
                  {edge.rel.fromColumn}
                </text>
              </g>
            ))}

            {diagram.nodes.map((node) => (
              <g key={`node-${node.table.name}`} transform={`translate(${node.x}, ${node.y})`}>
                <rect rx="10" width={node.width} height={node.height} fill="rgba(15,23,42,0.94)" stroke="rgba(148,163,184,0.34)" />
                <rect rx="10" width={node.width} height="32" fill="rgba(245,158,11,0.12)" />
                <text x="10" y="20" fontSize="12" fill="rgba(241,245,249,0.95)" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                  {node.table.name}
                </text>
                {node.table.columns.map((col, i) => (
                  <g key={`${node.table.name}-${col.name}`} transform={`translate(10, ${50 + i * 18})`}>
                    <text x="0" y="0" fontSize="11" fill={col.primary ? "#fbbf24" : "#cbd5e1"} fontFamily="JetBrains Mono, monospace">
                      {col.primary ? "PK " : "   "}
                      {col.name}
                    </text>
                    <text x={node.width - 12} y="0" textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                      {col.type}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 bg-background">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl bg-surface border border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={14} className="text-amber-400" />
            <h3 className="text-[13px] font-semibold text-primary">DB Health</h3>
          </div>
          {healthLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ) : (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2">
                <Badge variant={health?.status === "healthy" ? "success" : health?.status === "degraded" ? "warning" : "error"} dot>
                  {health?.status || "unknown"}
                </Badge>
                {health?.latencyMs != null && <span className="text-muted">{health.latencyMs}ms latency</span>}
              </div>
              <p className="text-secondary">{health?.engine || dbType.toUpperCase()} · {health?.database || dbName}</p>
              {health?.error ? <p className="text-red-400 text-[11px]">{health.error}</p> : null}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface border border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <TableProperties size={14} className="text-amber-400" />
            <h3 className="text-[13px] font-semibold text-primary">Schema Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-faint">Tables</p>
              <p className="text-primary font-semibold">{schemaLoading ? "..." : schema.length}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-faint">Columns</p>
              <p className="text-primary font-semibold">{schemaLoading ? "..." : totalColumns}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-faint">Relations</p>
              <p className="text-primary font-semibold">{schemaLoading ? "..." : relations.length}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-faint">Engine</p>
              <p className="text-primary font-semibold">{health?.engine || dbType}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface border border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-amber-400" />
            <h3 className="text-[13px] font-semibold text-primary">Recent Activity</h3>
          </div>
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center justify-between"><span className="text-faint">Queries tracked</span><span className="text-primary">{queryCount}</span></div>
            <div className="flex items-center justify-between"><span className="text-faint">Errors</span><span className={errorCount > 0 ? "text-red-400" : "text-primary"}>{errorCount}</span></div>
            <div className="flex items-center justify-between"><span className="text-faint">Last activity</span><span className="text-secondary">{latestActivity ? new Date(latestActivity).toLocaleString() : "—"}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-subtle flex items-center gap-2">
            <Network size={14} className="text-amber-400" />
            <h3 className="text-[13px] font-semibold text-primary">Entity Relationship Diagram</h3>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-subtle">
                <button
                  type="button"
                  className="px-2 py-0.5 text-[11px] text-secondary hover:text-primary"
                  onClick={() => setDiagramZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                >
                  -
                </button>
                <span className="text-[11px] text-secondary min-w-11 text-center">{Math.round(diagramZoom * 100)}%</span>
                <button
                  type="button"
                  className="px-2 py-0.5 text-[11px] text-secondary hover:text-primary"
                  onClick={() => setDiagramZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
                >
                  +
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={diagramFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                onClick={() => setDiagramFullscreen((v) => !v)}
              >
                {diagramFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </Button>
              <Button variant="outline" size="sm" icon={<Download size={12} />} onClick={downloadDiagramSvg}>
                Download
              </Button>
            </div>
          </div>
          <div className="p-4 overflow-auto" style={{ maxHeight: "420px" }}>
            {schemaLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-24 rounded-lg" />
                <div className="skeleton h-24 rounded-lg" />
              </div>
            ) : schema.length === 0 ? (
              <p className="text-[12px] text-muted">No schema available to render ER diagram.</p>
            ) : (
              renderDiagramCanvas()
            )}
          </div>
        </div>

        <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-subtle flex items-center gap-2">
            <Link2 size={14} className="text-amber-400" />
            <h3 className="text-[13px] font-semibold text-primary">Detected Relationships</h3>
          </div>
          <div className="p-4 overflow-auto" style={{ maxHeight: "420px" }}>
            {schemaLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-10 rounded-lg" />
                <div className="skeleton h-10 rounded-lg" />
              </div>
            ) : relations.length === 0 ? (
              <p className="text-[12px] text-muted">No explicit relationships detected. Add *_id naming conventions or foreign keys for richer ER mapping.</p>
            ) : (
              <div className="space-y-2">
                {relations.map((r, idx) => (
                  <div key={`${r.fromTable}-${r.fromColumn}-${idx}`} className="rounded-lg bg-surface-2 border border-subtle px-3 py-2 text-[12px]">
                    <span className="text-primary font-mono">{r.fromTable}</span>
                    <span className="text-faint">.</span>
                    <span className="text-secondary font-mono">{r.fromColumn}</span>
                    <span className="text-faint">  →  </span>
                    <span className="text-primary font-mono">{r.toTable}</span>
                    <span className="text-faint">.</span>
                    <span className="text-secondary font-mono">{r.toColumn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {diagramFullscreen && !schemaLoading && schema.length > 0 ? (
        <div className="fixed inset-0 z-80 bg-background/95 backdrop-blur-sm p-5">
          <div className="h-full rounded-xl bg-surface border border-subtle overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-subtle flex items-center gap-2">
              <Network size={14} className="text-amber-400" />
              <h3 className="text-[13px] font-semibold text-primary">Entity Relationship Diagram</h3>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-subtle">
                  <button
                    type="button"
                    className="px-2 py-0.5 text-[11px] text-secondary hover:text-primary"
                    onClick={() => setDiagramZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                  >
                    -
                  </button>
                  <span className="text-[11px] text-secondary min-w-11 text-center">{Math.round(diagramZoom * 100)}%</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 text-[11px] text-secondary hover:text-primary"
                    onClick={() => setDiagramZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
                  >
                    +
                  </button>
                </div>
                <Button variant="outline" size="sm" icon={<Download size={12} />} onClick={downloadDiagramSvg}>
                  Download
                </Button>
                <Button variant="outline" size="sm" icon={<X size={12} />} onClick={() => setDiagramFullscreen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {renderDiagramCanvas()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DatabaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, org } = useAuth();
  
  const [dbName, setDbName] = useState("Loading...");
  const [dbType, setDbType] = useState("");
  
  const [leftTab, setLeftTab] = useState<"schema" | "history">("schema");
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "overview", type: "overview", label: "Overview" },
    { id: "tab1", type: "query", label: "Query 1", sql: "" },
  ]);
  const [activeTab, setActiveTab] = useState("overview");
  const [running, setRunning] = useState(false);
  
  const [schema, setSchema] = useState<Table[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  const [results, setResults] = useState<QueryResult | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

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
        loadHealth();
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

  async function loadHealth() {
     setHealthLoading(true);
     try {
       const res = await fetch(`/api/connections/${id}/health`);
       const data = await res.json();
       if (res.ok) setHealth(data as HealthData);
     } catch {
       setHealth({ status: "down", latencyMs: null, error: "Failed to load health" });
     } finally {
       setHealthLoading(false);
     }
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
    <div className="flex flex-col h-screen bg-background">
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
        <div className="w-[240px] shrink-0 bg-surface border-r border-subtle flex flex-col overflow-hidden">
          {/* Tab switcher */}
          <div className="flex items-center border-b border-subtle">
            {(["schema", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2.5 text-[12px] font-medium capitalize transition-colors ${
                  leftTab === tab
                    ? "text-amber-400 border-b-2 border-amber-500"
                    : "text-muted hover:text-secondary"
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
          <div className="flex items-center bg-surface border-b border-subtle h-10 overflow-x-auto shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 h-full text-[12px] font-medium border-r border-subtle shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? "bg-surface text-primary border-t-2 border-t-amber-500"
                    : "text-muted hover:text-secondary hover:bg-surface"
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
              className="flex items-center justify-center w-8 h-full text-muted hover:text-secondary hover:bg-surface transition-colors shrink-0"
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

          {activeTabData?.type === "overview" ? (
            <DatabaseOverview
              dbName={dbName}
              dbType={dbType}
              schema={schema}
              schemaLoading={schemaLoading}
              history={history}
              health={health}
              healthLoading={healthLoading}
            />
          ) : activeTabData?.type === "table" ? (
            <div className="flex-1 overflow-hidden bg-background">
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
                className={`bg-surface shrink-0 overflow-auto font-mono text-[13px] leading-6 text-primary ${
                  results ? "h-[45%]" : "h-full"
                }`}
              >
                <div className="flex h-full min-h-full">
                  {/* Line numbers */}
                  <div className="w-10 shrink-0 bg-surface border-r border-subtle pt-3 pb-3 text-right pr-2.5 text-faint text-[12px] select-none overflow-hidden">
                    {(activeTabData?.sql?.split("\n") || [""]).map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={activeTabData?.sql || ""}
                    onChange={(e) => updateSql(e.target.value)}
                    className="flex-1 bg-transparent px-4 pt-3 pb-3 text-[13px] font-mono text-primary resize-none outline-none h-full min-h-[300px]"
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
                <div className="flex-[2] overflow-hidden bg-background border-t border-subtle">
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


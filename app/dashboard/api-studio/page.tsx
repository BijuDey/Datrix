"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  Box,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  Clock3,
  FileText,
  Folder,
  FlaskConical,
  Monitor,
  Play,
  Plus,
  Search,
  Save,
  Upload,
  Workflow,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

type ApiCollection = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  updated_at: string;
};

type ApiRequest = {
  id: string;
  collection_id: string | null;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body_type: string;
  body: unknown;
  pre_request_script?: string | null;
  tests_script?: string | null;
  updated_at: string;
  last_response_status?: number | null;
};

type ApiEnvironment = {
  id: string;
  name: string;
  variables: Record<string, string>;
  is_shared: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type SaveShortcut = {
  modifier: "meta" | "ctrl" | "alt";
  key: string;
};

type EditorTab = "params" | "authorization" | "headers" | "body" | "scripts" | "settings";

type KvRow = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description: string;
};

type AuthType = "none" | "bearer";
type ScriptTarget = "preRequestScript" | "testsScript";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const SHORTCUT_STORAGE_KEY = "apiStudio.saveShortcut.v1";
const SCRIPT_SUGGESTIONS: Array<{
  id: string;
  title: string;
  appliesTo: ScriptTarget;
  description: string;
  snippet: string;
}> = [
  {
    id: "pre-set-timestamp",
    title: "Set dynamic timestamp",
    appliesTo: "preRequestScript",
    description: "Create a request-time variable before the call is sent.",
    snippet: "pm.environment.set(\"currentTimestamp\", Date.now());",
  },
  {
    id: "pre-generate-id",
    title: "Generate request ID",
    appliesTo: "preRequestScript",
    description: "Attach a unique value you can reuse in headers/body.",
    snippet: "pm.environment.set(\"requestId\", pm.variables.replaceIn(\"{{$guid}}\"));",
  },
  {
    id: "test-status",
    title: "Assert status code",
    appliesTo: "testsScript",
    description: "Basic response validation to ensure API health.",
    snippet: "pm.test(\"Status code is 200\", function () {\n  pm.response.to.have.status(200);\n});",
  },
  {
    id: "test-json-field",
    title: "Assert JSON field",
    appliesTo: "testsScript",
    description: "Check required fields in response payload.",
    snippet:
      "pm.test(\"Response has success=true\", function () {\n  const body = pm.response.json();\n  pm.expect(body).to.have.property(\"success\", true);\n});",
  },
  {
    id: "test-response-time",
    title: "Assert response time",
    appliesTo: "testsScript",
    description: "Track latency and fail if endpoint is too slow.",
    snippet: "pm.test(\"Response time under 1000ms\", function () {\n  pm.expect(pm.response.responseTime).to.be.below(1000);\n});",
  },
];

function makeRow(partial?: Partial<KvRow>): KvRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    enabled: partial?.enabled ?? true,
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    description: partial?.description ?? "",
  };
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function interpolateTemplate(input: string, vars: Record<string, string>) {
  return input.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => vars[key] ?? "");
}

function toRows(record: Record<string, string> | null | undefined): KvRow[] {
  const entries = Object.entries(record || {});
  const rows = entries.map(([key, value]) =>
    makeRow({
      enabled: true,
      key,
      value: String(value),
    })
  );
  rows.push(makeRow({ enabled: true }));
  return rows;
}

function toRecord(rows: KvRow[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!row.enabled || !key) continue;
    output[key] = row.value;
  }
  return output;
}

function withTrailingBlank(rows: KvRow[]): KvRow[] {
  const next = [...rows];
  const hasBlank = next.some((row) => !row.key.trim() && !row.value.trim() && !row.description.trim());
  if (!hasBlank) next.push(makeRow({ enabled: true }));
  return next;
}

function getDefaultShortcut(): SaveShortcut {
  if (typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")) {
    return { modifier: "meta", key: "s" };
  }
  return { modifier: "ctrl", key: "s" };
}

function parseShortcut(input: string | null): SaveShortcut {
  const fallback = getDefaultShortcut();
  if (!input) return fallback;

  const parsed = safeJsonParse<Partial<SaveShortcut>>(input, {});
  const modifier = parsed.modifier;
  const key = parsed.key;

  if (!["meta", "ctrl", "alt"].includes(String(modifier || ""))) {
    return fallback;
  }

  const normalizedKey = String(key || "").trim().toLowerCase();
  if (!normalizedKey) return fallback;

  return {
    modifier: modifier as SaveShortcut["modifier"],
    key: normalizedKey,
  };
}

function formatShortcutLabel(shortcut: SaveShortcut) {
  const keyPart = shortcut.key.toUpperCase();
  if (shortcut.modifier === "meta") return `CMD+${keyPart}`;
  if (shortcut.modifier === "ctrl") return `CTRL+${keyPart}`;
  return `ALT+${keyPart}`;
}

function getMethodColorClass(method: string) {
  switch (String(method || "").toUpperCase()) {
    case "GET":
      return "text-emerald-400";
    case "POST":
      return "text-sky-400";
    case "PUT":
      return "text-amber-300";
    case "PATCH":
      return "text-fuchsia-400";
    case "DELETE":
      return "text-rose-400";
    case "OPTIONS":
      return "text-cyan-300";
    case "HEAD":
      return "text-violet-300";
    default:
      return "text-green-400";
  }
}

function shortcutMatches(event: KeyboardEvent, shortcut: SaveShortcut) {
  const expectedKey = shortcut.key.toLowerCase();
  const pressedKey = event.key.toLowerCase();

  const modifierMatch =
    (shortcut.modifier === "meta" && event.metaKey) ||
    (shortcut.modifier === "ctrl" && event.ctrlKey) ||
    (shortcut.modifier === "alt" && event.altKey);

  return modifierMatch && pressedKey === expectedKey;
}

function buildResolvedUrl(baseUrl: string, params: KvRow[], vars: Record<string, string>) {
  const interpolatedBaseUrl = interpolateTemplate(baseUrl, vars);
  const parsed = new URL(interpolatedBaseUrl);

  for (const row of params) {
    const key = row.key.trim();
    if (!row.enabled || !key) continue;
    parsed.searchParams.set(interpolateTemplate(key, vars), interpolateTemplate(row.value, vars));
  }

  return parsed.toString();
}

function inferAuthFromHeaders(headers: Record<string, string>): { authType: AuthType; authToken: string; headers: Record<string, string> } {
  const next = { ...headers };
  const authHeader = next.Authorization || next.authorization || "";

  if (/^Bearer\s+/i.test(authHeader)) {
    delete next.Authorization;
    delete next.authorization;
    return {
      authType: "bearer",
      authToken: authHeader.replace(/^Bearer\s+/i, ""),
      headers: next,
    };
  }

  return {
    authType: "none",
    authToken: "",
    headers: next,
  };
}

export default function ApiStudioPage() {
  const { org, canEdit } = useAuth();

  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [requests, setRequests] = useState<ApiRequest[]>([]);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<EditorTab>("params");

  const [editor, setEditor] = useState({
    name: "",
    method: "GET",
    url: "",
    paramsRows: [makeRow({ enabled: true })],
    headersRows: [makeRow({ enabled: true })],
    authType: "none" as AuthType,
    authToken: "",
    bodyText: "",
    preRequestScript: "",
    testsScript: "",
  });

  const [responseView, setResponseView] = useState<{
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
    error?: string;
  } | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [running, setRunning] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [saveShortcut, setSaveShortcut] = useState<SaveShortcut>(getDefaultShortcut());
  const [collapsedCollectionIds, setCollapsedCollectionIds] = useState<Record<string, boolean>>({});
  const [railSection, setRailSection] = useState<
    "collections" | "environments" | "history" | "apis" | "mock-servers" | "specs" | "monitors" | "flows" | "insights"
  >("collections");
  const [sidebarQuery, setSidebarQuery] = useState("");

  const saveRequestRef = useRef<() => Promise<void>>(async () => {});
  const lastLoadedRequestIdRef = useRef<string | null>(null);

  const selectedEnvironment = useMemo(
    () => environments.find((env) => env.id === selectedEnvironmentId) ?? null,
    [environments, selectedEnvironmentId]
  );

  const selectedRequest = useMemo(
    () => requests.find((req) => req.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const paramsCount = useMemo(
    () => editor.paramsRows.filter((row) => row.enabled && row.key.trim()).length,
    [editor.paramsRows]
  );

  const headersCount = useMemo(() => {
    const base = editor.headersRows.filter((row) => row.enabled && row.key.trim()).length;
    if (editor.authType === "bearer" && editor.authToken.trim()) return base + 1;
    return base;
  }, [editor.headersRows, editor.authType, editor.authToken]);

  const filteredCollections = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((collection) => collection.name.toLowerCase().includes(query));
  }, [collections, sidebarQuery]);

  const filteredRequests = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => {
      const hay = `${request.name} ${request.url} ${request.method}`.toLowerCase();
      return hay.includes(query);
    });
  }, [requests, sidebarQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedShortcut = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    setSaveShortcut(parseShortcut(storedShortcut));
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== SHORTCUT_STORAGE_KEY) return;
      setSaveShortcut(parseShortcut(event.newValue));
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!org) return;
    void loadCollections(org.id);
    void loadEnvironments(org.id);
  }, [org]);

  useEffect(() => {
    if (!org || !selectedCollectionId) {
      setRequests([]);
      return;
    }
    void loadRequests(org.id, selectedCollectionId);
  }, [org, selectedCollectionId]);

  useEffect(() => {
    if (!selectedRequestId || !selectedRequest) return;
    if (lastLoadedRequestIdRef.current === selectedRequestId) return;

    const inferred = inferAuthFromHeaders(selectedRequest.headers || {});

    let bodyText = "";
    if (typeof selectedRequest.body === "string") {
      bodyText = selectedRequest.body;
    } else if (selectedRequest.body !== null && selectedRequest.body !== undefined) {
      bodyText = JSON.stringify(selectedRequest.body, null, 2);
    }

    setEditor({
      name: selectedRequest.name,
      method: selectedRequest.method,
      url: selectedRequest.url,
      paramsRows: toRows(selectedRequest.query_params || {}),
      headersRows: toRows(inferred.headers),
      authType: inferred.authType,
      authToken: inferred.authToken,
      bodyText,
      preRequestScript: selectedRequest.pre_request_script || "",
      testsScript: selectedRequest.tests_script || "",
    });

    lastLoadedRequestIdRef.current = selectedRequestId;
    setIsDirty(false);
    setSaveState("idle");
  }, [selectedRequestId, selectedRequest]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!shortcutMatches(event, saveShortcut)) return;
      if (!canEdit || !selectedRequestId) return;

      event.preventDefault();
      void saveRequestRef.current();
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [saveShortcut, canEdit, selectedRequestId]);

  async function loadCollections(orgId: string) {
    const response = await fetch(`/api/api-studio/collections?org_id=${orgId}`);
    if (!response.ok) return;
    const payload = await response.json();
    const rows = payload.collections || [];
    setCollections(rows);
    setCollapsedCollectionIds((previous) => {
      const next: Record<string, boolean> = {};
      for (const row of rows) {
        if (previous[row.id]) next[row.id] = true;
      }
      return next;
    });

    setSelectedCollectionId((current) => {
      if (current && rows.some((row: ApiCollection) => row.id === current)) return current;
      return rows.length > 0 ? rows[0].id : null;
    });
  }

  async function loadRequests(orgId: string, collectionId: string) {
    const response = await fetch(`/api/api-studio/requests?org_id=${orgId}&collection_id=${collectionId}`);
    if (!response.ok) return;
    const payload = await response.json();
    const rows = payload.requests || [];
    setRequests(rows);

    if (rows.length === 0) {
      setSelectedRequestId(null);
      lastLoadedRequestIdRef.current = null;
      return;
    }

    setSelectedRequestId((current) => {
      if (current && rows.some((row: ApiRequest) => row.id === current)) return current;
      return rows[0].id;
    });
  }

  async function loadEnvironments(orgId: string) {
    const response = await fetch(`/api/api-studio/environments?org_id=${orgId}`);
    if (!response.ok) return;
    const payload = await response.json();
    const rows = payload.environments || [];
    setEnvironments(rows);

    setSelectedEnvironmentId((current) => {
      if (current && rows.some((row: ApiEnvironment) => row.id === current)) return current;
      return rows.length > 0 ? rows[0].id : null;
    });
  }

  async function createCollection() {
    if (!org || !canEdit) return;
    const name = window.prompt("Collection name", "New Collection")?.trim();
    if (!name) return;

    const response = await fetch("/api/api-studio/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, name }),
    });

    if (!response.ok) return;
    const payload = await response.json();
    setCollections((prev) => [payload.collection, ...prev]);
    setCollapsedCollectionIds((prev) => {
      const next = { ...prev };
      delete next[payload.collection.id];
      return next;
    });
    setSelectedCollectionId(payload.collection.id);
  }

  async function createRequest() {
    if (!org || !selectedCollectionId || !canEdit) return;

    const response = await fetch("/api/api-studio/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        collectionId: selectedCollectionId,
        name: "New Request",
        method: "GET",
        url: "https://api.github.com",
      }),
    });

    if (!response.ok) return;
    const payload = await response.json();
    setRequests((prev) => [payload.request, ...prev]);
    setSelectedRequestId(payload.request.id);
    lastLoadedRequestIdRef.current = null;
  }

  async function renameCollection(collection: ApiCollection) {
    if (!org || !canEdit) return;
    const nextName = window.prompt("Rename collection", collection.name)?.trim();
    if (!nextName || nextName === collection.name) return;

    const response = await fetch("/api/api-studio/collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: collection.id,
        orgId: org.id,
        name: nextName,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Rename failed" }));
      window.alert(payload.error || "Rename failed");
      return;
    }

    const payload = await response.json();
    setCollections((prev) => prev.map((item) => (item.id === collection.id ? payload.collection : item)));
  }

  async function deleteCollection(collection: ApiCollection) {
    if (!org || !canEdit) return;
    const confirmed = window.confirm(
      `Delete collection "${collection.name}" and all requests inside it? This cannot be undone.`
    );
    if (!confirmed) return;

    const response = await fetch(
      `/api/api-studio/collections?id=${encodeURIComponent(collection.id)}&org_id=${encodeURIComponent(org.id)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Delete failed" }));
      window.alert(payload.error || "Delete failed");
      return;
    }

    setCollections((prev) => prev.filter((item) => item.id !== collection.id));
    setCollapsedCollectionIds((prev) => {
      const next = { ...prev };
      delete next[collection.id];
      return next;
    });
    if (selectedCollectionId === collection.id) {
      setSelectedCollectionId((current) => {
        if (current !== collection.id) return current;
        const remaining = collections.filter((item) => item.id !== collection.id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
      setRequests([]);
      setSelectedRequestId(null);
      lastLoadedRequestIdRef.current = null;
    }
  }

  async function renameRequest(request: ApiRequest) {
    if (!org || !canEdit) return;
    const nextName = window.prompt("Rename request", request.name)?.trim();
    if (!nextName || nextName === request.name) return;

    const response = await fetch("/api/api-studio/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: request.id,
        orgId: org.id,
        name: nextName,
        source: "manual-save",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Rename failed" }));
      window.alert(payload.error || "Rename failed");
      return;
    }

    const payload = await response.json();
    setRequests((prev) => prev.map((item) => (item.id === request.id ? payload.request : item)));
    if (selectedRequestId === request.id) {
      setEditor((prev) => ({ ...prev, name: payload.request.name }));
      setIsDirty(false);
      setSaveState("idle");
    }
  }

  async function deleteRequest(request: ApiRequest) {
    if (!org || !canEdit) return;
    const confirmed = window.confirm(`Delete request "${request.name}"? This cannot be undone.`);
    if (!confirmed) return;

    const response = await fetch(
      `/api/api-studio/requests?id=${encodeURIComponent(request.id)}&org_id=${encodeURIComponent(org.id)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Delete failed" }));
      window.alert(payload.error || "Delete failed");
      return;
    }

    setRequests((prev) => {
      const next = prev.filter((item) => item.id !== request.id);
      if (selectedRequestId === request.id) {
        setSelectedRequestId(next.length > 0 ? next[0].id : null);
        if (next.length === 0) {
          lastLoadedRequestIdRef.current = null;
        }
      }
      return next;
    });
  }

  async function createEnvironment() {
    if (!org || !canEdit) return;
    const name = window.prompt("Environment name", "Local")?.trim();
    if (!name) return;

    const response = await fetch("/api/api-studio/environments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, name, variables: {}, isShared: true }),
    });

    if (!response.ok) return;
    const payload = await response.json();
    setEnvironments((prev) => [payload.environment, ...prev]);
    setSelectedEnvironmentId(payload.environment.id);
  }

  async function saveCurrentRequest() {
    if (!org || !selectedRequestId || !canEdit) return;

    const headers = toRecord(editor.headersRows);
    const queryParams = toRecord(editor.paramsRows);

    if (editor.authType === "bearer" && editor.authToken.trim()) {
      headers.Authorization = `Bearer ${editor.authToken.trim()}`;
    }

    let body: unknown = null;
    let bodyType = "none";
    if (editor.bodyText.trim()) {
      bodyType = "json";
      body = safeJsonParse(editor.bodyText, editor.bodyText);
    }

    setSaveState("saving");

    const response = await fetch("/api/api-studio/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedRequestId,
        orgId: org.id,
        name: editor.name,
        method: editor.method,
        url: editor.url,
        headers,
        queryParams,
        bodyType,
        body,
        preRequestScript: editor.preRequestScript,
        testsScript: editor.testsScript,
        source: "shortcut-save",
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      const payload = await response.json().catch(() => ({ error: "Save failed" }));
      window.alert(payload.error || "Save failed");
      return;
    }

    const payload = await response.json();
    setRequests((prev) => prev.map((item) => (item.id === payload.request.id ? payload.request : item)));
    setSaveState("saved");
    setIsDirty(false);
  }

  saveRequestRef.current = saveCurrentRequest;

  async function runRequest() {
    if (!org || !selectedRequestId) return;

    const variables = selectedEnvironment?.variables || {};

    let resolvedUrl: string;
    try {
      resolvedUrl = buildResolvedUrl(editor.url, editor.paramsRows, variables);
    } catch {
      setResponseView({ error: "URL is invalid" });
      return;
    }

    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(toRecord(editor.headersRows))) {
      resolvedHeaders[interpolateTemplate(key, variables)] = interpolateTemplate(value, variables);
    }

    if (editor.authType === "bearer" && editor.authToken.trim()) {
      resolvedHeaders.Authorization = `Bearer ${interpolateTemplate(editor.authToken, variables)}`;
    }

    const bodyText = interpolateTemplate(editor.bodyText, variables);
    const resolvedBody = bodyText.trim() ? safeJsonParse(bodyText, bodyText) : undefined;

    setRunning(true);
    setResponseView(null);

    try {
      const response = await fetch("/api/api-studio/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          url: resolvedUrl,
          method: editor.method,
          headers: resolvedHeaders,
          body: resolvedBody,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResponseView({ error: payload.error || "Request failed", status: response.status });
      } else {
        setResponseView({
          status: payload.status,
          data: payload.data,
          headers: payload.headers,
        });
      }

      await fetch("/api/api-studio/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRequestId,
          orgId: org.id,
          lastResponseStatus: payload.status || response.status,
          lastRunAt: new Date().toISOString(),
          source: "runtime-update",
        }),
      });

      setRequests((prev) =>
        prev.map((item) =>
          item.id === selectedRequestId
            ? {
                ...item,
                last_response_status: payload.status || response.status,
              }
            : item
        )
      );
    } catch (error) {
      setResponseView({
        error: error instanceof Error ? error.message : "Unable to run request",
      });
    } finally {
      setRunning(false);
    }
  }

  async function handleImportPostman() {
    if (!org || !canEdit) return;

    const collection = safeJsonParse(importJson, null);
    if (!collection) {
      window.alert("Invalid JSON");
      return;
    }

    const response = await fetch("/api/api-studio/import/postman", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, collection }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Import failed" }));
      window.alert(payload.error || "Import failed");
      return;
    }

    const payload = await response.json();

    setImportOpen(false);
    setImportJson("");
    await loadCollections(org.id);
    await loadEnvironments(org.id);

    if (payload?.collection?.id) {
      setSelectedCollectionId(payload.collection.id);
      lastLoadedRequestIdRef.current = null;
      await loadRequests(org.id, payload.collection.id);
    }

    if (typeof payload?.importedRequests === "number") {
      const total = typeof payload?.totalRequests === "number" ? payload.totalRequests : payload.importedRequests;
      const failed = typeof payload?.failedRequests === "number" ? payload.failedRequests : Math.max(total - payload.importedRequests, 0);
      const summary = `Imported ${payload.importedRequests}/${total} requests${failed > 0 ? ` (${failed} failed)` : ""}.`;
      window.alert(summary);
    }
  }

  function markDirty() {
    setIsDirty(true);
    if (saveState !== "idle") setSaveState("idle");
  }

  function updateEditorField<K extends keyof typeof editor>(key: K, value: (typeof editor)[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  function updateRows(type: "paramsRows" | "headersRows", index: number, field: keyof KvRow, value: string | boolean) {
    setEditor((prev) => {
      const rows = [...prev[type]];
      const row = { ...rows[index], [field]: value } as KvRow;
      rows[index] = row;
      return {
        ...prev,
        [type]: withTrailingBlank(rows),
      };
    });
    markDirty();
  }

  function toggleCollectionCollapsed(collectionId: string) {
    setCollapsedCollectionIds((prev) => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }));
  }

  function insertScriptSuggestion(target: ScriptTarget, snippet: string) {
    setEditor((prev) => {
      const current = prev[target].trim();
      const next = current ? `${current}\n\n${snippet}` : snippet;
      return {
        ...prev,
        [target]: next,
      };
    });
    markDirty();
  }

  const tabs: Array<{ id: EditorTab; label: string; count?: number }> = [
    { id: "params", label: "Params", count: paramsCount },
    { id: "authorization", label: "Authorization" },
    { id: "headers", label: "Headers", count: headersCount },
    { id: "body", label: "Body" },
    { id: "scripts", label: "Scripts" },
    { id: "settings", label: "Settings" },
  ];

  const railItems: Array<{
    id: "collections" | "environments" | "history" | "apis" | "mock-servers" | "specs" | "monitors" | "flows" | "insights";
    label: string;
    icon: React.ReactNode;
    enabled?: boolean;
  }> = [
    { id: "collections", label: "Collections", icon: <Folder size={16} />, enabled: true },
    { id: "environments", label: "Environments", icon: <FlaskConical size={16} />, enabled: true },
    { id: "history", label: "History", icon: <Clock3 size={16} /> },
    { id: "apis", label: "APIs", icon: <Box size={16} /> },
    { id: "mock-servers", label: "Mock servers", icon: <Monitor size={16} /> },
    { id: "specs", label: "Specs", icon: <FileText size={16} /> },
    { id: "monitors", label: "Monitors", icon: <Activity size={16} /> },
    { id: "flows", label: "Flows", icon: <Workflow size={16} /> },
    { id: "insights", label: "Insights", icon: <BookOpen size={16} /> },
  ];

  return (
    <div className="h-screen w-full bg-base text-primary overflow-hidden">
      <div className="h-full grid grid-cols-[82px_340px_1fr]">
        <aside className="h-full border-r border-subtle bg-[#181818] flex flex-col items-stretch py-2 px-2 gap-1">
          {railItems.map((item) => {
            const isActive = railSection === item.id;
            return (
              <button
                key={item.id}
                className={`w-full rounded-lg px-2 py-2.5 text-center transition-all border ${
                  isActive
                    ? "bg-white/6 border-white/10 text-primary"
                    : "bg-transparent border-transparent text-muted hover:text-secondary hover:bg-white/4"
                } ${item.enabled === false ? "opacity-55" : ""}`}
                onClick={() => {
                  if (item.enabled === false) return;
                  setRailSection(item.id);
                }}
              >
                <div className="flex justify-center">{item.icon}</div>
                <p className="text-[11px] mt-1.5 leading-[1.1]">{item.label}</p>
              </button>
            );
          })}
          <div className="mt-auto">
            <Link href="/dashboard" className="block">
              <Button size="sm" variant="ghost" icon={<ArrowLeft size={12} />}>
                Exit
              </Button>
            </Link>
          </div>
        </aside>

        <aside className="h-full border-r border-subtle bg-surface flex flex-col">
          <div className="h-14 px-3 border-b border-subtle flex items-center justify-between gap-2">
            <div className="h-9 rounded-md border border-subtle bg-surface-2 flex items-center gap-2 px-2 flex-1">
              <Search size={14} className="text-muted" />
              <input
                value={sidebarQuery}
                onChange={(event) => setSidebarQuery(event.target.value)}
                placeholder={railSection === "environments" ? "Search environments" : "Search collections"}
                className="w-full bg-transparent outline-none text-[12px] text-primary"
              />
            </div>
            {railSection === "collections" ? (
              <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={createCollection}>
                New
              </Button>
            ) : (
              <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={createEnvironment}>
                New
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {railSection === "collections" && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Collections</p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" icon={<Upload size={11} />} onClick={() => setImportOpen(true)}>
                      Import
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Plus size={11} />} onClick={createRequest}>
                      Request
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {filteredCollections.map((collection) => {
                    const isSelectedCollection = selectedCollectionId === collection.id;
                    const isCollapsed = Boolean(collapsedCollectionIds[collection.id]);
                    const visibleRequests = isSelectedCollection ? filteredRequests : [];

                    return (
                      <div key={collection.id} className="rounded-md">
                        <button
                          className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-1.5 border transition-all ${
                            isSelectedCollection
                              ? "bg-amber-500/8 border-amber-500/30 text-amber-300"
                              : "bg-transparent border-transparent text-secondary hover:bg-white/4 hover:text-primary"
                          }`}
                          onClick={() => {
                            setSelectedCollectionId(collection.id);
                            setCollapsedCollectionIds((prev) => ({ ...prev, [collection.id]: false }));
                            lastLoadedRequestIdRef.current = null;
                          }}
                        >
                          <span
                            role="button"
                            tabIndex={0}
                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCollectionCollapsed(collection.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleCollectionCollapsed(collection.id);
                              }
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          </span>
                          <Folder size={13} />
                          <span className="text-[12px] truncate">{collection.name}</span>
                          {canEdit ? (
                            <span className="ml-auto flex items-center gap-1">
                              <span
                                role="button"
                                tabIndex={0}
                                className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/10 text-muted hover:text-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void renameCollection(collection);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void renameCollection(collection);
                                  }
                                }}
                              >
                                <Pencil size={11} />
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-red-500/20 text-muted hover:text-red-300"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteCollection(collection);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void deleteCollection(collection);
                                  }
                                }}
                              >
                                <Trash2 size={11} />
                              </span>
                            </span>
                          ) : null}
                        </button>

                        {isSelectedCollection && !isCollapsed && (
                          <div className="pl-7 pr-1 py-1 space-y-1">
                            {visibleRequests.length === 0 ? (
                              <p className="text-[11px] text-muted px-2 py-1">No requests</p>
                            ) : (
                              visibleRequests.map((request) => {
                                const isSelectedRequest = selectedRequestId === request.id;
                                return (
                                  <button
                                    key={request.id}
                                    className={`w-full rounded-md px-2 py-1.5 text-left border transition-all ${
                                      isSelectedRequest
                                        ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                                        : "bg-transparent border-transparent text-secondary hover:text-primary hover:bg-white/4"
                                    }`}
                                    onClick={() => {
                                      setSelectedRequestId(request.id);
                                      lastLoadedRequestIdRef.current = null;
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] font-semibold ${getMethodColorClass(request.method)}`}>
                                        {request.method}
                                      </span>
                                      <span className="text-[12px] truncate">{request.name}</span>
                                      {canEdit ? (
                                        <span className="ml-auto flex items-center gap-1">
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/10 text-muted hover:text-primary"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void renameRequest(request);
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                void renameRequest(request);
                                              }
                                            }}
                                          >
                                            <Pencil size={11} />
                                          </span>
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-red-500/20 text-muted hover:text-red-300"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void deleteRequest(request);
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                void deleteRequest(request);
                                              }
                                            }}
                                          >
                                            <Trash2 size={11} />
                                          </span>
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {railSection === "environments" && (
              <div className="space-y-1">
                {environments
                  .filter((environment) => {
                    if (!sidebarQuery.trim()) return true;
                    return environment.name.toLowerCase().includes(sidebarQuery.trim().toLowerCase());
                  })
                  .map((environment) => (
                    <button
                      key={environment.id}
                      className={`w-full text-left px-2.5 py-2 rounded-md border transition-all ${
                        selectedEnvironmentId === environment.id
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                          : "bg-surface border-subtle text-secondary hover:text-primary"
                      }`}
                      onClick={() => setSelectedEnvironmentId(environment.id)}
                    >
                      <p className="text-[12px] font-medium truncate">{environment.name}</p>
                      <p className="text-[10px] text-muted">{Object.keys(environment.variables || {}).length} variables</p>
                    </button>
                  ))}
              </div>
            )}

            {railSection !== "collections" && railSection !== "environments" && (
              <div className="rounded-md border border-subtle bg-surface-2 p-3 text-[12px] text-muted">
                This section is coming next. Use Collections to create and run requests.
              </div>
            )}
          </div>

          <div className="border-t border-subtle p-2">
            <Link href="/dashboard/settings" className="block text-[11px] text-amber-400 hover:text-amber-300 px-1">
              Edit save shortcut in Settings
            </Link>
          </div>
        </aside>

        <main className="h-full overflow-y-auto bg-base">
          {!selectedRequest ? (
            <div className="h-full flex items-center justify-center text-muted text-[13px]">
              Select or create a request
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-subtle bg-surface p-3 flex items-center gap-2">
                <select
                  value={editor.method}
                  onChange={(event) => updateEditorField("method", event.target.value)}
                  className={`h-9 px-3 rounded-md border bg-surface-2 border-subtle text-[12px] font-semibold ${getMethodColorClass(
                    editor.method
                  )}`}
                >
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <Input
                  value={editor.url}
                  onChange={(event) => updateEditorField("url", event.target.value)}
                  placeholder="https://api.example.com/v1/users"
                  className="font-mono"
                />
                <Button variant="primary" size="sm" loading={running} icon={<Play size={12} />} onClick={runRequest}>
                  Send
                </Button>
              </div>

              <div className="rounded-lg border border-subtle bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-subtle flex items-center justify-between">
                  <Input
                    label="Request Name"
                    value={editor.name}
                    onChange={(event) => updateEditorField("name", event.target.value)}
                    className="w-[320px]"
                  />

                  <div className="flex items-center gap-2 pt-5">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Save size={12} />}
                      onClick={() => void saveCurrentRequest()}
                      disabled={!canEdit || !isDirty || saveState === "saving"}
                    >
                      Save {formatShortcutLabel(saveShortcut)}
                    </Button>
                  </div>
                </div>

                <div className="px-3 border-b border-subtle flex items-center gap-5 h-11 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={`text-[12px] pb-2 border-b-2 transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? "border-amber-400 text-primary"
                          : "border-transparent text-muted hover:text-secondary"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                      {typeof tab.count === "number" ? (
                        <span className="ml-1 text-[11px] text-green-400">({tab.count})</span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="p-3">
                  {activeTab === "params" && (
                    <div className="rounded-md border border-subtle overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-surface-2 text-muted">
                          <tr>
                            <th className="w-12 px-2 py-2 border-b border-r border-subtle text-left">On</th>
                            <th className="px-2 py-2 border-b border-r border-subtle text-left">Key</th>
                            <th className="px-2 py-2 border-b border-r border-subtle text-left">Value</th>
                            <th className="px-2 py-2 border-b border-subtle text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editor.paramsRows.map((row, index) => (
                            <tr key={row.id} className="border-b border-subtle/60">
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <button
                                  onClick={() => updateRows("paramsRows", index, "enabled", !row.enabled)}
                                  className={`h-5 w-5 rounded border inline-flex items-center justify-center ${
                                    row.enabled ? "border-amber-400 bg-amber-500/15 text-amber-300" : "border-subtle text-transparent"
                                  }`}
                                >
                                  <Check size={12} />
                                </button>
                              </td>
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.key}
                                  onChange={(e) => updateRows("paramsRows", index, "key", e.target.value)}
                                  placeholder="key"
                                />
                              </td>
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.value}
                                  onChange={(e) => updateRows("paramsRows", index, "value", e.target.value)}
                                  placeholder="value"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.description}
                                  onChange={(e) => updateRows("paramsRows", index, "description", e.target.value)}
                                  placeholder="description"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "headers" && (
                    <div className="rounded-md border border-subtle overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-surface-2 text-muted">
                          <tr>
                            <th className="w-12 px-2 py-2 border-b border-r border-subtle text-left">On</th>
                            <th className="px-2 py-2 border-b border-r border-subtle text-left">Key</th>
                            <th className="px-2 py-2 border-b border-r border-subtle text-left">Value</th>
                            <th className="px-2 py-2 border-b border-subtle text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editor.headersRows.map((row, index) => (
                            <tr key={row.id} className="border-b border-subtle/60">
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <button
                                  onClick={() => updateRows("headersRows", index, "enabled", !row.enabled)}
                                  className={`h-5 w-5 rounded border inline-flex items-center justify-center ${
                                    row.enabled ? "border-amber-400 bg-amber-500/15 text-amber-300" : "border-subtle text-transparent"
                                  }`}
                                >
                                  <Check size={12} />
                                </button>
                              </td>
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.key}
                                  onChange={(e) => updateRows("headersRows", index, "key", e.target.value)}
                                  placeholder="key"
                                />
                              </td>
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.value}
                                  onChange={(e) => updateRows("headersRows", index, "value", e.target.value)}
                                  placeholder="value"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.description}
                                  onChange={(e) => updateRows("headersRows", index, "description", e.target.value)}
                                  placeholder="description"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "authorization" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[12px] text-muted mb-1 block">Auth Type</label>
                        <select
                          className="h-10 w-full rounded-md border border-subtle bg-surface-2 px-3 text-[12px]"
                          value={editor.authType}
                          onChange={(e) => updateEditorField("authType", e.target.value as AuthType)}
                        >
                          <option value="none">No Auth</option>
                          <option value="bearer">Bearer Token</option>
                        </select>
                      </div>

                      {editor.authType === "bearer" ? (
                        <Input
                          label="Token"
                          value={editor.authToken}
                          onChange={(e) => updateEditorField("authToken", e.target.value)}
                          placeholder="{{token}}"
                          className="font-mono"
                        />
                      ) : null}
                    </div>
                  )}

                  {activeTab === "body" && (
                    <Textarea
                      label="Raw Body"
                      rows={14}
                      value={editor.bodyText}
                      onChange={(e) => updateEditorField("bodyText", e.target.value)}
                      className="font-mono"
                      placeholder='{"name":"John"}'
                    />
                  )}

                  {activeTab === "scripts" && (
                    <div className="space-y-3">
                      <div className="rounded-md border border-subtle bg-surface-2 p-3 space-y-2">
                        <p className="text-[12px] font-semibold text-primary">Script helper</p>
                        <p className="text-[11px] text-muted">
                          Pre-request scripts run before request is sent. Tests scripts run after response is received.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                            Use <span className="font-mono text-primary">pm.environment.set</span> to store variables.
                          </div>
                          <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                            Use <span className="font-mono text-primary">{"{{name}}"}</span> variables in URL, headers, and body.
                          </div>
                          <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                            Use <span className="font-mono text-primary">pm.response</span> only in Tests script.
                          </div>
                          <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                            Use <span className="font-mono text-primary">pm.test</span> and <span className="font-mono text-primary">pm.expect</span> for assertions.
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {SCRIPT_SUGGESTIONS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="text-[11px] rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary hover:text-primary hover:border-amber-500/40"
                              onClick={() => insertScriptSuggestion(item.appliesTo, item.snippet)}
                              title={item.description}
                            >
                              Add: {item.title}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Textarea
                        label="Pre-request Script"
                        rows={7}
                        value={editor.preRequestScript}
                        onChange={(e) => updateEditorField("preRequestScript", e.target.value)}
                        className="font-mono"
                        placeholder="// pre request script"
                      />
                      <Textarea
                        label="Tests Script"
                        rows={7}
                        value={editor.testsScript}
                        onChange={(e) => updateEditorField("testsScript", e.target.value)}
                        className="font-mono"
                        placeholder="// tests script"
                      />
                      <div className="rounded-md border border-subtle bg-surface-2 p-2.5 text-[11px] text-muted">
                        Learn more:&nbsp;
                        <a
                          href="https://learning.postman.com/docs/tests-and-scripts/write-scripts/pre-request-scripts/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:text-amber-300"
                        >
                          Pre-request scripts
                        </a>
                        &nbsp;|&nbsp;
                        <a
                          href="https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:text-amber-300"
                        >
                          Test scripts
                        </a>
                        &nbsp;|&nbsp;
                        <a
                          href="https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-api-reference/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:text-amber-300"
                        >
                          Sandbox API reference
                        </a>
                      </div>
                    </div>
                  )}

                  {activeTab === "settings" && (
                    <div className="text-[12px] text-muted space-y-2">
                      <p>Environment variables in all fields are supported with double braces.</p>
                      <p className="font-mono text-secondary">Example: {"{{token}}"} or {"https://api.example.com/{{version}}"}</p>
                      <p>
                        Edit save shortcut from <Link className="text-amber-400" href="/dashboard/settings">Settings</Link>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-subtle px-3 py-2 text-[11px] flex items-center justify-between bg-surface-2">
                  <span className="text-muted">Save mode: Manual</span>
                  <span
                    className={
                      saveState === "saving"
                        ? "text-amber-400"
                        : saveState === "saved"
                          ? "text-green-400"
                          : saveState === "error"
                            ? "text-red-400"
                            : isDirty
                              ? "text-amber-300"
                              : "text-muted"
                    }
                  >
                    {saveState === "saving"
                      ? "Saving..."
                      : saveState === "saved"
                        ? "Saved"
                        : saveState === "error"
                          ? "Save failed"
                          : isDirty
                            ? "Unsaved changes"
                            : "No changes"}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-subtle bg-surface p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold">Response</p>
                  {responseView?.status ? <Badge variant="success">{responseView.status}</Badge> : null}
                </div>

                {responseView?.error ? (
                  <pre className="text-[11px] text-red-400 overflow-auto max-h-80">{responseView.error}</pre>
                ) : responseView ? (
                  <pre className="text-[11px] text-secondary overflow-auto max-h-80">
                    {JSON.stringify(responseView.data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-[11px] text-muted">Run request to view response</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setImportOpen(false)} />
          <div className="relative w-full max-w-2xl bg-surface border border-subtle rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-primary">Import Postman Collection JSON</h3>
              <button className="text-muted hover:text-primary" onClick={() => setImportOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <Textarea
              rows={16}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              className="font-mono"
              placeholder="Paste exported Postman collection JSON"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleImportPostman}>
                Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

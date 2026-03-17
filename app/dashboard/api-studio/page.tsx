"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { JsonCodeEditor } from "@/components/ui/JsonCodeEditor";
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

type RequestLeaf = {
  request: ApiRequest;
  title: string;
};

type RequestFolderNode = {
  id: string;
  name: string;
  folders: RequestFolderNode[];
  requests: RequestLeaf[];
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

type EditorTab =
  | "params"
  | "authorization"
  | "headers"
  | "body"
  | "scripts"
  | "settings";

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
const API_STUDIO_CACHE_PREFIX = "apiStudio.cache.v1";

type ApiStudioCacheSnapshot = {
  collections: ApiCollection[];
  environments: ApiEnvironment[];
  requests: ApiRequest[];
  requestsCollectionId: string | null;
  selectedCollectionId: string | null;
  selectedRequestId: string | null;
  selectedEnvironmentId: string | null;
  railSection:
    | "collections"
    | "environments"
    | "history"
    | "apis"
    | "mock-servers"
    | "specs"
    | "monitors"
    | "flows"
    | "insights";
  sidebarPanelWidth: number;
  responsePanelHeight: number;
};

function getApiStudioCacheKey(orgId: string) {
  return `${API_STUDIO_CACHE_PREFIX}.${orgId}`;
}
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
    snippet: 'pm.environment.set("currentTimestamp", Date.now());',
  },
  {
    id: "pre-generate-id",
    title: "Generate request ID",
    appliesTo: "preRequestScript",
    description: "Attach a unique value you can reuse in headers/body.",
    snippet:
      'pm.environment.set("requestId", pm.variables.replaceIn("{{$guid}}"));',
  },
  {
    id: "test-status",
    title: "Assert status code",
    appliesTo: "testsScript",
    description: "Basic response validation to ensure API health.",
    snippet:
      'pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});',
  },
  {
    id: "test-json-field",
    title: "Assert JSON field",
    appliesTo: "testsScript",
    description: "Check required fields in response payload.",
    snippet:
      'pm.test("Response has success=true", function () {\n  const body = pm.response.json();\n  pm.expect(body).to.have.property("success", true);\n});',
  },
  {
    id: "test-response-time",
    title: "Assert response time",
    appliesTo: "testsScript",
    description: "Track latency and fail if endpoint is too slow.",
    snippet:
      'pm.test("Response time under 1000ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(1000);\n});',
  },
];

function makeRow(partial?: Partial<KvRow>): KvRow {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
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
  const hasBlank = next.some(
    (row) => !row.key.trim() && !row.value.trim() && !row.description.trim()
  );
  if (!hasBlank) next.push(makeRow({ enabled: true }));
  return next;
}

function getDefaultShortcut(): SaveShortcut {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  ) {
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

  const normalizedKey = String(key || "")
    .trim()
    .toLowerCase();
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

function formatResponseDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs < 0) return "-";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatResponseSize(sizeBytes: number | undefined) {
  if (!sizeBytes || sizeBytes < 0) return "-";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryParseJsonString(value: string) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeResponseData(value: unknown): unknown {
  if (typeof value === "string") {
    return tryParseJsonString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeResponseData(entry));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>
    )) {
      normalized[key] = normalizeResponseData(entry);
    }
    return normalized;
  }

  return value;
}

function getRequestNameSegments(name: string): string[] {
  return String(name || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getRequestLeafName(name: string): string {
  const segments = getRequestNameSegments(name);
  if (segments.length === 0) return String(name || "").trim();
  return segments[segments.length - 1];
}

function mergeRequestNameWithExistingPath(
  existingName: string,
  nextLeafName: string
): string {
  const leaf = String(nextLeafName || "").trim();
  if (!leaf) return leaf;

  const segments = getRequestNameSegments(existingName);
  if (segments.length <= 1) return leaf;

  const separator = String(existingName || "").includes(" / ") ? " / " : "/";
  const parentPath = segments.slice(0, -1).join(separator);
  return parentPath ? `${parentPath}${separator}${leaf}` : leaf;
}

function buildRequestTree(requests: ApiRequest[]): RequestFolderNode {
  const root: RequestFolderNode = {
    id: "__root__",
    name: "",
    folders: [],
    requests: [],
  };

  function ensureFolder(
    parent: RequestFolderNode,
    segment: string,
    folderId: string
  ) {
    let existing = parent.folders.find((folder) => folder.id === folderId);
    if (!existing) {
      existing = {
        id: folderId,
        name: segment,
        folders: [],
        requests: [],
      };
      parent.folders.push(existing);
    }
    return existing;
  }

  for (const request of requests) {
    const segments = getRequestNameSegments(request.name);
    const fallbackName = String(request.name || "Untitled Request").trim();
    const title =
      segments.length > 0 ? segments[segments.length - 1] : fallbackName;
    const folderSegments = segments.slice(0, -1);

    if (folderSegments.length === 0) {
      root.requests.push({ request, title });
      continue;
    }

    let cursor = root;
    let folderPath = "";
    for (const segment of folderSegments) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      cursor = ensureFolder(cursor, segment, folderPath);
    }

    cursor.requests.push({ request, title });
  }

  return root;
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

function buildResolvedUrl(
  baseUrl: string,
  params: KvRow[],
  vars: Record<string, string>
) {
  const interpolatedBaseUrl = interpolateTemplate(baseUrl, vars);
  const parsed = new URL(interpolatedBaseUrl);

  for (const row of params) {
    const key = row.key.trim();
    if (!row.enabled || !key) continue;
    parsed.searchParams.set(
      interpolateTemplate(key, vars),
      interpolateTemplate(row.value, vars)
    );
  }

  return parsed.toString();
}

function buildUrlWithParams(baseUrl: string, params: KvRow[]) {
  const url = String(baseUrl || "");
  const queryPairs = params
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => {
      const key = row.key.trim();
      const value = row.value ?? "";
      return `${key}=${value}`;
    });

  if (queryPairs.length === 0) return url;

  const hashIndex = url.indexOf("#");
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const basePart = hashIndex >= 0 ? url.slice(0, hashIndex) : url;

  if (!basePart) {
    return `?${queryPairs.join("&")}${hashPart}`;
  }

  const needsSeparator =
    basePart.includes("?") &&
    !basePart.endsWith("?") &&
    !basePart.endsWith("&");
  const separator = basePart.includes("?") ? (needsSeparator ? "&" : "") : "?";

  return `${basePart}${separator}${queryPairs.join("&")}${hashPart}`;
}

function splitTemplateSegments(input: string, vars: Record<string, string>) {
  const source = String(input || "");
  const segments: Array<{
    text: string;
    type: "plain" | "found" | "missing";
    variableName?: string;
    variableValue?: string;
  }> = [];
  const pattern = /{{\s*([^}]+?)\s*}}/g;

  let lastIndex = 0;
  let match = pattern.exec(source);

  while (match) {
    const fullMatch = match[0];
    const key = String(match[1] || "").trim();
    const index = match.index;

    if (index > lastIndex) {
      segments.push({
        text: source.slice(lastIndex, index),
        type: "plain",
      });
    }

    const rawValue = Object.prototype.hasOwnProperty.call(vars, key)
      ? vars[key]
      : undefined;
    const resolvedValue = rawValue == null ? "" : String(rawValue);
    const found = resolvedValue.trim().length > 0;
    segments.push({
      text: fullMatch,
      type: found ? "found" : "missing",
      variableName: key,
      variableValue: resolvedValue,
    });

    lastIndex = index + fullMatch.length;
    match = pattern.exec(source);
  }

  if (lastIndex < source.length) {
    segments.push({ text: source.slice(lastIndex), type: "plain" });
  }

  if (segments.length === 0) {
    segments.push({ text: source, type: "plain" });
  }

  return segments;
}

function inferAuthFromHeaders(headers: Record<string, string>): {
  authType: AuthType;
  authToken: string;
  headers: Record<string, string>;
} {
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
  const [requestsCollectionId, setRequestsCollectionId] = useState<
    string | null
  >(null);

  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | null
  >(null);

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
    durationMs?: number;
    sizeBytes?: number;
    localAgent?: {
      checked: boolean;
      isLocalTarget: boolean;
      running: boolean;
      startCommand: string;
      healthCommand: string;
      triedHealthUrls: string[];
    };
    scripts?: {
      preRequest?: {
        runtimeError: string | null;
        tests: Array<{ name: string; passed: boolean; error?: string }>;
      };
      tests?: {
        runtimeError: string | null;
        tests: Array<{ name: string; passed: boolean; error?: string }>;
      };
    };
  } | null>(null);
  const [responsePanelTab, setResponsePanelTab] = useState<
    "body" | "headers" | "tests"
  >("body");

  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [running, setRunning] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [environmentsLoading, setEnvironmentsLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [environmentEditorName, setEnvironmentEditorName] = useState("");
  const [environmentRows, setEnvironmentRows] = useState<KvRow[]>([
    makeRow({ enabled: true }),
  ]);
  const [environmentDirty, setEnvironmentDirty] = useState(false);
  const [environmentSaving, setEnvironmentSaving] = useState(false);
  const [bodyValidationError, setBodyValidationError] = useState<string | null>(
    null
  );
  const [saveShortcut, setSaveShortcut] = useState<SaveShortcut>(
    getDefaultShortcut()
  );
  const [collapsedCollectionIds, setCollapsedCollectionIds] = useState<
    Record<string, boolean>
  >({});
  const [collapsedRequestFolderIds, setCollapsedRequestFolderIds] = useState<
    Record<string, boolean>
  >({});
  const [railSection, setRailSection] = useState<
    | "collections"
    | "environments"
    | "history"
    | "apis"
    | "mock-servers"
    | "specs"
    | "monitors"
    | "flows"
    | "insights"
  >("collections");
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarPanelWidth, setSidebarPanelWidth] = useState(340);
  const [responsePanelHeight, setResponsePanelHeight] = useState(360);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingResponse, setIsDraggingResponse] = useState(false);

  const saveRequestRef = useRef<() => Promise<void>>(async () => {});
  const lastLoadedRequestIdRef = useRef<string | null>(null);
  const hydratedOrgIdRef = useRef<string | null>(null);
  const sidebarResizeRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const responseResizeRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const selectedEnvironment = useMemo(
    () => environments.find((env) => env.id === selectedEnvironmentId) ?? null,
    [environments, selectedEnvironmentId]
  );

  const selectedRequest = useMemo(
    () => requests.find((req) => req.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const paramsCount = useMemo(
    () =>
      editor.paramsRows.filter((row) => row.enabled && row.key.trim()).length,
    [editor.paramsRows]
  );

  const headersCount = useMemo(() => {
    const base = editor.headersRows.filter(
      (row) => row.enabled && row.key.trim()
    ).length;
    if (editor.authType === "bearer" && editor.authToken.trim())
      return base + 1;
    return base;
  }, [editor.headersRows, editor.authType, editor.authToken]);

  const hasAuthConfigured =
    editor.authType !== "none" || Boolean(editor.authToken.trim());
  const hasBodyConfigured = Boolean(editor.bodyText.trim());
  const hasScriptsConfigured =
    Boolean(editor.preRequestScript.trim()) ||
    Boolean(editor.testsScript.trim());

  const filteredCollections = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(query)
    );
  }, [collections, sidebarQuery]);

  const filteredRequests = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => {
      const hay =
        `${request.name} ${request.url} ${request.method}`.toLowerCase();
      return hay.includes(query);
    });
  }, [requests, sidebarQuery]);

  const requestTree = useMemo(
    () => buildRequestTree(filteredRequests),
    [filteredRequests]
  );

  const hasCollections = collections.length > 0;
  const hasSelectedCollection = Boolean(selectedCollectionId);
  const composedRequestUrl = useMemo(
    () => buildUrlWithParams(editor.url, editor.paramsRows),
    [editor.url, editor.paramsRows]
  );
  const urlPreviewSegments = useMemo(
    () =>
      splitTemplateSegments(
        composedRequestUrl,
        selectedEnvironment?.variables || {}
      ),
    [composedRequestUrl, selectedEnvironment?.variables]
  );
  const missingUrlVariables = useMemo(
    () =>
      urlPreviewSegments
        .filter((segment) => segment.type === "missing")
        .map((segment) => segment.variableName || segment.text),
    [urlPreviewSegments]
  );
  const normalizedResponseData = useMemo(
    () => normalizeResponseData(responseView?.data),
    [responseView?.data]
  );
  const responseHeadersList = useMemo(
    () => Object.entries(responseView?.headers || {}),
    [responseView?.headers]
  );
  const responseTestResults = responseView?.scripts?.tests?.tests || [];
  const passedTestsCount = responseTestResults.filter((t) => t.passed).length;
  const responseContentMaxHeight = Math.max(responsePanelHeight - 130, 160);

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
    if (!org) {
      setCollectionsLoading(false);
      setEnvironmentsLoading(false);
      setRequestsLoading(false);
      setRequestsCollectionId(null);
      hydratedOrgIdRef.current = null;
      return;
    }

    let hydratedFromCache = false;
    if (typeof window !== "undefined" && hydratedOrgIdRef.current !== org.id) {
      hydratedOrgIdRef.current = org.id;
      const raw = window.sessionStorage.getItem(getApiStudioCacheKey(org.id));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ApiStudioCacheSnapshot;
          setCollections(parsed.collections || []);
          setEnvironments(parsed.environments || []);
          setRequests(parsed.requests || []);
          setRequestsCollectionId(parsed.requestsCollectionId || null);
          setSelectedCollectionId(parsed.selectedCollectionId || null);
          setSelectedRequestId(parsed.selectedRequestId || null);
          setSelectedEnvironmentId(parsed.selectedEnvironmentId || null);
          setRailSection(parsed.railSection || "collections");
          setSidebarPanelWidth(
            Math.max(
              280,
              Math.min(620, Number(parsed.sidebarPanelWidth) || 340)
            )
          );
          setResponsePanelHeight(
            Math.max(
              220,
              Math.min(760, Number(parsed.responsePanelHeight) || 360)
            )
          );

          if ((parsed.collections || []).length > 0)
            setCollectionsLoading(false);
          if ((parsed.environments || []).length > 0)
            setEnvironmentsLoading(false);
          if ((parsed.requests || []).length > 0) setRequestsLoading(false);
          hydratedFromCache = true;
        } catch {
          // Ignore invalid cache payload.
        }
      }
    }

    void loadCollections(
      org.id,
      !hydratedFromCache && collections.length === 0
    );
    void loadEnvironments(
      org.id,
      !hydratedFromCache && environments.length === 0
    );
  }, [org]);

  useEffect(() => {
    if (
      !org ||
      hydratedOrgIdRef.current !== org.id ||
      typeof window === "undefined"
    ) {
      return;
    }

    const snapshot: ApiStudioCacheSnapshot = {
      collections,
      environments,
      requests,
      requestsCollectionId,
      selectedCollectionId,
      selectedRequestId,
      selectedEnvironmentId,
      railSection,
      sidebarPanelWidth,
      responsePanelHeight,
    };

    window.sessionStorage.setItem(
      getApiStudioCacheKey(org.id),
      JSON.stringify(snapshot)
    );
  }, [
    org,
    collections,
    environments,
    requests,
    requestsCollectionId,
    selectedCollectionId,
    selectedRequestId,
    selectedEnvironmentId,
    railSection,
    sidebarPanelWidth,
    responsePanelHeight,
  ]);

  useEffect(() => {
    if (!org || !selectedCollectionId) {
      setRequests([]);
      setRequestsCollectionId(null);
      setRequestsLoading(false);
      return;
    }
    if (requestsCollectionId === selectedCollectionId && requests.length > 0) {
      return;
    }
    const shouldShowLoader = requestsCollectionId !== selectedCollectionId;
    void loadRequests(org.id, selectedCollectionId, shouldShowLoader);
  }, [org, selectedCollectionId, requestsCollectionId, requests.length]);

  useEffect(() => {
    if (!selectedRequestId || !selectedRequest) return;
    if (lastLoadedRequestIdRef.current === selectedRequestId) return;

    const inferred = inferAuthFromHeaders(selectedRequest.headers || {});

    let bodyText = "";
    if (typeof selectedRequest.body === "string") {
      bodyText = selectedRequest.body;
    } else if (
      selectedRequest.body !== null &&
      selectedRequest.body !== undefined
    ) {
      bodyText = JSON.stringify(selectedRequest.body, null, 2);
    }

    setEditor({
      name: getRequestLeafName(selectedRequest.name),
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
    if (!selectedEnvironment) {
      setEnvironmentEditorName("");
      setEnvironmentRows([makeRow({ enabled: true })]);
      setEnvironmentDirty(false);
      return;
    }

    setEnvironmentEditorName(selectedEnvironment.name || "");
    setEnvironmentRows(toRows(selectedEnvironment.variables || {}));
    setEnvironmentDirty(false);
  }, [selectedEnvironment]);

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

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (isDraggingSidebar && sidebarResizeRef.current) {
        const delta = event.clientX - sidebarResizeRef.current.startX;
        const next = sidebarResizeRef.current.startWidth + delta;
        setSidebarPanelWidth(Math.max(280, Math.min(620, next)));
      }

      if (isDraggingResponse && responseResizeRef.current) {
        const delta = responseResizeRef.current.startY - event.clientY;
        const next = responseResizeRef.current.startHeight + delta;
        setResponsePanelHeight(Math.max(220, Math.min(760, next)));
      }
    }

    function handleMouseUp() {
      setIsDraggingSidebar(false);
      setIsDraggingResponse(false);
      sidebarResizeRef.current = null;
      responseResizeRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    if (!isDraggingSidebar && !isDraggingResponse) return;

    document.body.style.userSelect = "none";
    document.body.style.cursor = isDraggingSidebar
      ? "col-resize"
      : "row-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingResponse, isDraggingSidebar]);

  async function loadCollections(orgId: string, showLoader = true) {
    if (showLoader) setCollectionsLoading(true);
    try {
      const response = await fetch(
        `/api/api-studio/collections?org_id=${orgId}`
      );
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
        if (current && rows.some((row: ApiCollection) => row.id === current))
          return current;
        return rows.length > 0 ? rows[0].id : null;
      });
    } finally {
      if (showLoader) setCollectionsLoading(false);
    }
  }

  async function loadRequests(
    orgId: string,
    collectionId: string,
    showLoader = true
  ) {
    if (showLoader) setRequestsLoading(true);
    try {
      const response = await fetch(
        `/api/api-studio/requests?org_id=${orgId}&collection_id=${collectionId}`
      );
      if (!response.ok) return;
      const payload = await response.json();
      const rows = payload.requests || [];
      setRequests(rows);
      setRequestsCollectionId(collectionId);

      if (rows.length === 0) {
        setSelectedRequestId(null);
        lastLoadedRequestIdRef.current = null;
        return;
      }

      setSelectedRequestId((current) => {
        if (current && rows.some((row: ApiRequest) => row.id === current))
          return current;
        return rows[0].id;
      });
    } finally {
      if (showLoader) setRequestsLoading(false);
    }
  }

  async function loadEnvironments(orgId: string, showLoader = true) {
    if (showLoader) setEnvironmentsLoading(true);
    try {
      const response = await fetch(
        `/api/api-studio/environments?org_id=${orgId}`
      );
      if (!response.ok) return;
      const payload = await response.json();
      const rows = payload.environments || [];
      setEnvironments(rows);

      setSelectedEnvironmentId((current) => {
        if (current && rows.some((row: ApiEnvironment) => row.id === current))
          return current;
        return rows.length > 0 ? rows[0].id : null;
      });
    } finally {
      if (showLoader) setEnvironmentsLoading(false);
    }
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
    setRequestsCollectionId(selectedCollectionId);
    setSelectedRequestId(payload.request.id);
    lastLoadedRequestIdRef.current = null;
  }

  async function renameCollection(collection: ApiCollection) {
    if (!org || !canEdit) return;
    const nextName = window
      .prompt("Rename collection", collection.name)
      ?.trim();
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
      const payload = await response
        .json()
        .catch(() => ({ error: "Rename failed" }));
      window.alert(payload.error || "Rename failed");
      return;
    }

    const payload = await response.json();
    setCollections((prev) =>
      prev.map((item) =>
        item.id === collection.id ? payload.collection : item
      )
    );
  }

  async function deleteCollection(collection: ApiCollection) {
    if (!org || !canEdit) return;
    const confirmed = window.confirm(
      `Delete collection "${collection.name}" and all requests inside it? This cannot be undone.`
    );
    if (!confirmed) return;

    const response = await fetch(
      `/api/api-studio/collections?id=${encodeURIComponent(
        collection.id
      )}&org_id=${encodeURIComponent(org.id)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "Delete failed" }));
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
        const remaining = collections.filter(
          (item) => item.id !== collection.id
        );
        return remaining.length > 0 ? remaining[0].id : null;
      });
      setRequests([]);
      setRequestsCollectionId(null);
      setSelectedRequestId(null);
      lastLoadedRequestIdRef.current = null;
    }
  }

  async function renameRequest(request: ApiRequest) {
    if (!org || !canEdit) return;
    const currentLeafName = getRequestLeafName(request.name);
    const nextName = window.prompt("Rename request", currentLeafName)?.trim();
    if (!nextName || nextName === currentLeafName) return;

    const mergedName = mergeRequestNameWithExistingPath(request.name, nextName);

    const response = await fetch("/api/api-studio/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: request.id,
        orgId: org.id,
        name: mergedName,
        source: "manual-save",
      }),
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "Rename failed" }));
      window.alert(payload.error || "Rename failed");
      return;
    }

    const payload = await response.json();
    setRequests((prev) =>
      prev.map((item) => (item.id === request.id ? payload.request : item))
    );
    if (selectedRequestId === request.id) {
      setEditor((prev) => ({
        ...prev,
        name: getRequestLeafName(payload.request.name),
      }));
      setIsDirty(false);
      setSaveState("idle");
    }
  }

  async function deleteRequest(request: ApiRequest) {
    if (!org || !canEdit) return;
    const confirmed = window.confirm(
      `Delete request "${request.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    const response = await fetch(
      `/api/api-studio/requests?id=${encodeURIComponent(
        request.id
      )}&org_id=${encodeURIComponent(org.id)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "Delete failed" }));
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
      body: JSON.stringify({
        orgId: org.id,
        name,
        variables: {},
        isShared: true,
      }),
    });

    if (!response.ok) return;
    const payload = await response.json();
    setEnvironments((prev) => [payload.environment, ...prev]);
    setSelectedEnvironmentId(payload.environment.id);
  }

  function updateEnvironmentRow(
    index: number,
    field: keyof KvRow,
    value: string | boolean
  ) {
    setEnvironmentRows((prev) => {
      const rows = [...prev];
      rows[index] = { ...rows[index], [field]: value } as KvRow;
      return withTrailingBlank(rows);
    });
    setEnvironmentDirty(true);
  }

  async function saveEnvironment() {
    if (!org || !selectedEnvironment || !canEdit) return;

    const nextName = environmentEditorName.trim();
    if (!nextName) {
      window.alert("Environment name is required");
      return;
    }

    setEnvironmentSaving(true);

    const response = await fetch("/api/api-studio/environments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedEnvironment.id,
        orgId: org.id,
        name: nextName,
        variables: toRecord(environmentRows),
        isShared: selectedEnvironment.is_shared,
      }),
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "Failed to save environment" }));
      window.alert(payload.error || "Failed to save environment");
      setEnvironmentSaving(false);
      return;
    }

    const payload = await response.json();
    setEnvironments((prev) =>
      prev.map((item) =>
        item.id === payload.environment.id ? payload.environment : item
      )
    );
    setEnvironmentEditorName(payload.environment.name || "");
    setEnvironmentRows(toRows(payload.environment.variables || {}));
    setEnvironmentDirty(false);
    setEnvironmentSaving(false);
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

    const mergedName = mergeRequestNameWithExistingPath(
      selectedRequest?.name || editor.name,
      editor.name
    );

    setSaveState("saving");

    const response = await fetch("/api/api-studio/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedRequestId,
        orgId: org.id,
        name: mergedName,
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
      const payload = await response
        .json()
        .catch(() => ({ error: "Save failed" }));
      window.alert(payload.error || "Save failed");
      return;
    }

    const payload = await response.json();
    setRequests((prev) =>
      prev.map((item) =>
        item.id === payload.request.id ? payload.request : item
      )
    );
    setSaveState("saved");
    setIsDirty(false);
  }

  saveRequestRef.current = saveCurrentRequest;

  async function runRequest() {
    if (!org || !selectedRequestId) return;

    const baseHeaders = toRecord(editor.headersRows);
    if (editor.authType === "bearer" && editor.authToken.trim()) {
      baseHeaders.Authorization = `Bearer ${editor.authToken.trim()}`;
    }

    const queryParams = toRecord(editor.paramsRows);
    const requestBody = editor.bodyText.trim()
      ? safeJsonParse(editor.bodyText, editor.bodyText)
      : undefined;

    setRunning(true);
    setResponseView(null);
    setResponsePanelTab("body");

    try {
      const response = await fetch("/api/api-studio/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          url: editor.url,
          method: editor.method,
          headers: baseHeaders,
          queryParams,
          body: requestBody,
          preRequestScript: editor.preRequestScript,
          testsScript: editor.testsScript,
          environmentVariables: selectedEnvironment?.variables || {},
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResponseView({
          error: payload.error || "Request failed",
          status: response.status,
          durationMs: payload.durationMs,
          sizeBytes: payload.sizeBytes,
          localAgent: payload.localAgent,
          scripts: payload.scripts,
        });
      } else {
        setResponseView({
          status: payload.status,
          data: payload.data,
          headers: payload.headers,
          durationMs: payload.durationMs,
          sizeBytes: payload.sizeBytes,
          scripts: payload.scripts,
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
      const payload = await response
        .json()
        .catch(() => ({ error: "Import failed" }));
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
      const total =
        typeof payload?.totalRequests === "number"
          ? payload.totalRequests
          : payload.importedRequests;
      const failed =
        typeof payload?.failedRequests === "number"
          ? payload.failedRequests
          : Math.max(total - payload.importedRequests, 0);
      const summary = `Imported ${payload.importedRequests}/${total} requests${
        failed > 0 ? ` (${failed} failed)` : ""
      }.`;
      window.alert(summary);
    }
  }

  function markDirty() {
    setIsDirty(true);
    if (saveState !== "idle") setSaveState("idle");
  }

  function updateEditorField<K extends keyof typeof editor>(
    key: K,
    value: (typeof editor)[K]
  ) {
    setEditor((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  function updateRows(
    type: "paramsRows" | "headersRows",
    index: number,
    field: keyof KvRow,
    value: string | boolean
  ) {
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

  function toggleRequestFolderCollapsed(folderId: string) {
    setCollapsedRequestFolderIds((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
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

  function beginSidebarResize(event: React.MouseEvent<HTMLDivElement>) {
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarPanelWidth,
    };
    setIsDraggingSidebar(true);
  }

  function beginResponseResize(event: React.MouseEvent<HTMLDivElement>) {
    responseResizeRef.current = {
      startY: event.clientY,
      startHeight: responsePanelHeight,
    };
    setIsDraggingResponse(true);
  }

  function formatBodyAsJson() {
    const content = editor.bodyText.trim();
    if (!content) return;

    try {
      const formatted = JSON.stringify(JSON.parse(editor.bodyText), null, 2);
      updateEditorField("bodyText", formatted);
      setBodyValidationError(null);
    } catch (error) {
      setBodyValidationError(
        error instanceof Error ? error.message : "Invalid JSON body"
      );
    }
  }

  const tabs: Array<{
    id: EditorTab;
    label: string;
    count?: number;
    hasConfiguredData?: boolean;
  }> = [
    {
      id: "params",
      label: "Params",
      count: paramsCount,
      hasConfiguredData: paramsCount > 0,
    },
    {
      id: "authorization",
      label: "Authorization",
      hasConfiguredData: hasAuthConfigured,
    },
    {
      id: "headers",
      label: "Headers",
      count: headersCount,
      hasConfiguredData: headersCount > 0,
    },
    { id: "body", label: "Body", hasConfiguredData: hasBodyConfigured },
    {
      id: "scripts",
      label: "Scripts",
      hasConfiguredData: hasScriptsConfigured,
    },
    { id: "settings", label: "Settings" },
  ];

  const railItems: Array<{
    id:
      | "collections"
      | "environments"
      | "history"
      | "apis"
      | "mock-servers"
      | "specs"
      | "monitors"
      | "flows"
      | "insights";
    label: string;
    icon: React.ReactNode;
    enabled?: boolean;
  }> = [
    {
      id: "collections",
      label: "Collections",
      icon: <Folder size={16} />,
      enabled: true,
    },
    {
      id: "environments",
      label: "Environments",
      icon: <FlaskConical size={16} />,
      enabled: true,
    },
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
      <div
        className="h-full min-h-0 grid"
        style={{
          gridTemplateColumns: `68px ${sidebarPanelWidth}px 8px minmax(0, 1fr)`,
        }}
      >
        <aside className="h-full min-h-0 border-r border-subtle bg-[#181818] flex flex-col items-stretch py-2 px-2 gap-1">
          {railItems.map((item) => {
            const isActive = railSection === item.id;
            return (
              <button
                key={item.id}
                className={`group relative w-full h-12 overflow-visible rounded-lg px-1 py-2 text-center transition-all border ${
                  isActive
                    ? "bg-white/6 border-white/10 text-primary"
                    : "bg-transparent border-transparent text-muted hover:text-secondary hover:bg-white/4"
                } ${item.enabled === false ? "opacity-55" : ""}`}
                title={item.label}
                onClick={() => {
                  if (item.enabled === false) return;
                  setRailSection(item.id);
                }}
              >
                <div className="flex justify-center">{item.icon}</div>
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-subtle bg-surface-2 px-2 py-1 text-[11px] text-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 z-20">
                  {item.label}
                </span>
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

        <aside className="h-full min-h-0 border-r border-subtle bg-surface flex flex-col">
          <div className="h-14 px-3 border-b border-subtle flex items-center justify-between gap-2">
            <div className="h-9 rounded-md border border-subtle bg-surface-2 flex items-center gap-2 px-2 flex-1">
              <Search size={14} className="text-muted" />
              <input
                value={sidebarQuery}
                onChange={(event) => setSidebarQuery(event.target.value)}
                placeholder={
                  railSection === "environments"
                    ? "Search environments"
                    : "Search collections"
                }
                className="w-full bg-transparent outline-none text-[12px] text-primary"
              />
            </div>
            {railSection === "collections" ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={12} />}
                onClick={createCollection}
              >
                New
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={12} />}
                onClick={createEnvironment}
              >
                New
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {railSection === "collections" && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted">
                    Collections
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Upload size={11} />}
                      onClick={() => setImportOpen(true)}
                    >
                      Import
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Plus size={11} />}
                      onClick={createRequest}
                    >
                      Request
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {collectionsLoading ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, index) => (
                        <div
                          key={`collection-skeleton-${index}`}
                          className="h-9 rounded-md border border-subtle bg-surface-2 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : filteredCollections.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-subtle bg-surface-2 p-3 text-[12px] text-muted space-y-2">
                      {collections.length === 0 ? (
                        <>
                          <p className="text-secondary">No collections yet.</p>
                          <p>
                            Create your first collection or import one from
                            Postman.
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Plus size={12} />}
                              onClick={createCollection}
                            >
                              New Collection
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Upload size={12} />}
                              onClick={() => setImportOpen(true)}
                            >
                              Import JSON
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p>No collections match your search.</p>
                      )}
                    </div>
                  ) : (
                    filteredCollections.map((collection) => {
                      const isSelectedCollection =
                        selectedCollectionId === collection.id;
                      const isCollapsed = Boolean(
                        collapsedCollectionIds[collection.id]
                      );
                      const visibleRequests = isSelectedCollection
                        ? filteredRequests
                        : [];

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
                              setCollapsedCollectionIds((prev) => ({
                                ...prev,
                                [collection.id]: false,
                              }));
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
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  toggleCollectionCollapsed(collection.id);
                                }
                              }}
                            >
                              {isCollapsed ? (
                                <ChevronRight size={13} />
                              ) : (
                                <ChevronDown size={13} />
                              )}
                            </span>
                            <Folder size={13} />
                            <span className="text-[12px] truncate">
                              {collection.name}
                            </span>
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
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
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
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
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
                              {requestsLoading ? (
                                <div className="space-y-2 py-1">
                                  {[...Array(3)].map((_, index) => (
                                    <div
                                      key={`request-skeleton-${index}`}
                                      className="h-7 rounded-md border border-subtle bg-surface-2 animate-pulse"
                                    />
                                  ))}
                                </div>
                              ) : visibleRequests.length === 0 ? (
                                <p className="text-[11px] text-muted px-2 py-1">
                                  No requests
                                </p>
                              ) : (
                                <>
                                  {requestTree.requests.map((leaf) => {
                                    const request = leaf.request;
                                    const isSelectedRequest =
                                      selectedRequestId === request.id;
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
                                          <span
                                            className={`text-[10px] font-semibold ${getMethodColorClass(
                                              request.method
                                            )}`}
                                          >
                                            {request.method}
                                          </span>
                                          <span className="text-[12px] truncate">
                                            {leaf.title}
                                          </span>
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
                                                  if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                  ) {
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
                                                  if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                  ) {
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
                                  })}

                                  {requestTree.folders.map((folder) => {
                                    const isFolderCollapsed = Boolean(
                                      collapsedRequestFolderIds[folder.id]
                                    );

                                    function renderFolder(
                                      node: RequestFolderNode,
                                      depth: number
                                    ): React.ReactNode {
                                      const collapsed = Boolean(
                                        collapsedRequestFolderIds[node.id]
                                      );

                                      return (
                                        <div
                                          key={node.id}
                                          className="space-y-1"
                                        >
                                          <button
                                            className="w-full rounded-md px-2 py-1.5 text-left border border-transparent text-secondary hover:text-primary hover:bg-white/4 flex items-center gap-1.5"
                                            style={{
                                              paddingLeft: `${
                                                8 + depth * 14
                                              }px`,
                                            }}
                                            onClick={() =>
                                              toggleRequestFolderCollapsed(
                                                node.id
                                              )
                                            }
                                          >
                                            {collapsed ? (
                                              <ChevronRight size={12} />
                                            ) : (
                                              <ChevronDown size={12} />
                                            )}
                                            <Folder size={12} />
                                            <span className="text-[12px] truncate">
                                              {node.name}
                                            </span>
                                          </button>

                                          {!collapsed && (
                                            <div className="space-y-1">
                                              {node.requests.map((leaf) => {
                                                const request = leaf.request;
                                                const isSelectedRequest =
                                                  selectedRequestId ===
                                                  request.id;

                                                return (
                                                  <button
                                                    key={request.id}
                                                    className={`w-full rounded-md px-2 py-1.5 text-left border transition-all ${
                                                      isSelectedRequest
                                                        ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                                                        : "bg-transparent border-transparent text-secondary hover:text-primary hover:bg-white/4"
                                                    }`}
                                                    style={{
                                                      paddingLeft: `${
                                                        22 + depth * 14
                                                      }px`,
                                                    }}
                                                    onClick={() => {
                                                      setSelectedRequestId(
                                                        request.id
                                                      );
                                                      lastLoadedRequestIdRef.current =
                                                        null;
                                                    }}
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <span
                                                        className={`text-[10px] font-semibold ${getMethodColorClass(
                                                          request.method
                                                        )}`}
                                                      >
                                                        {request.method}
                                                      </span>
                                                      <span className="text-[12px] truncate">
                                                        {leaf.title}
                                                      </span>
                                                      {canEdit ? (
                                                        <span className="ml-auto flex items-center gap-1">
                                                          <span
                                                            role="button"
                                                            tabIndex={0}
                                                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/10 text-muted hover:text-primary"
                                                            onClick={(
                                                              event
                                                            ) => {
                                                              event.stopPropagation();
                                                              void renameRequest(
                                                                request
                                                              );
                                                            }}
                                                            onKeyDown={(
                                                              event
                                                            ) => {
                                                              if (
                                                                event.key ===
                                                                  "Enter" ||
                                                                event.key ===
                                                                  " "
                                                              ) {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                void renameRequest(
                                                                  request
                                                                );
                                                              }
                                                            }}
                                                          >
                                                            <Pencil size={11} />
                                                          </span>
                                                          <span
                                                            role="button"
                                                            tabIndex={0}
                                                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-red-500/20 text-muted hover:text-red-300"
                                                            onClick={(
                                                              event
                                                            ) => {
                                                              event.stopPropagation();
                                                              void deleteRequest(
                                                                request
                                                              );
                                                            }}
                                                            onKeyDown={(
                                                              event
                                                            ) => {
                                                              if (
                                                                event.key ===
                                                                  "Enter" ||
                                                                event.key ===
                                                                  " "
                                                              ) {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                void deleteRequest(
                                                                  request
                                                                );
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
                                              })}

                                              {node.folders.map((child) =>
                                                renderFolder(child, depth + 1)
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (isFolderCollapsed) {
                                      return (
                                        <button
                                          key={folder.id}
                                          className="w-full rounded-md px-2 py-1.5 text-left border border-transparent text-secondary hover:text-primary hover:bg-white/4 flex items-center gap-1.5"
                                          onClick={() =>
                                            toggleRequestFolderCollapsed(
                                              folder.id
                                            )
                                          }
                                        >
                                          <ChevronRight size={12} />
                                          <Folder size={12} />
                                          <span className="text-[12px] truncate">
                                            {folder.name}
                                          </span>
                                        </button>
                                      );
                                    }

                                    return renderFolder(folder, 0);
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {railSection === "environments" && (
              <div className="space-y-1">
                {environmentsLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, index) => (
                      <div
                        key={`environment-skeleton-${index}`}
                        className="h-12 rounded-md border border-subtle bg-surface-2 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  environments
                    .filter((environment) => {
                      if (!sidebarQuery.trim()) return true;
                      return environment.name
                        .toLowerCase()
                        .includes(sidebarQuery.trim().toLowerCase());
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
                        <p className="text-[12px] font-medium truncate">
                          {environment.name}
                        </p>
                        <p className="text-[10px] text-muted">
                          {Object.keys(environment.variables || {}).length}{" "}
                          variables
                        </p>
                      </button>
                    ))
                )}
              </div>
            )}

            {railSection !== "collections" &&
              railSection !== "environments" && (
                <div className="rounded-md border border-subtle bg-surface-2 p-3 text-[12px] text-muted">
                  This section is coming next. Use Collections to create and run
                  requests.
                </div>
              )}
          </div>

          <div className="border-t border-subtle p-2">
            <Link
              href="/dashboard/settings"
              className="block text-[11px] text-amber-400 hover:text-amber-300 px-1"
            >
              Edit save shortcut in Settings
            </Link>
          </div>
        </aside>

        <div
          className={`h-full cursor-col-resize transition-colors ${
            isDraggingSidebar
              ? "bg-amber-500/30"
              : "bg-transparent hover:bg-amber-500/20"
          }`}
          onMouseDown={beginSidebarResize}
          title="Drag to resize collections panel"
        />

        <main className="h-full min-h-0 overflow-hidden bg-base">
          {railSection === "environments" ? (
            <div className="h-full min-h-0 p-4 flex flex-col gap-3">
              {selectedEnvironment ? (
                <>
                  <div className="rounded-lg border border-subtle bg-surface px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Input
                        label="Environment Name"
                        value={environmentEditorName}
                        onChange={(event) => {
                          setEnvironmentEditorName(event.target.value);
                          setEnvironmentDirty(true);
                        }}
                        className="max-w-[420px]"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Save size={12} />}
                      onClick={saveEnvironment}
                      loading={environmentSaving}
                      disabled={!canEdit || !environmentDirty}
                    >
                      Save Environment
                    </Button>
                  </div>

                  <div className="rounded-lg border border-subtle bg-surface overflow-hidden flex-1 min-h-0">
                    <div className="px-3 py-2 border-b border-subtle flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-primary">
                        Variables
                      </p>
                      <p className="text-[11px] text-muted">
                        {Object.keys(toRecord(environmentRows)).length} active
                      </p>
                    </div>
                    <div className="min-h-0 h-full overflow-auto">
                      <table className="w-full text-[12px]">
                        <thead className="bg-surface-2 text-muted sticky top-0 z-10">
                          <tr>
                            <th className="w-12 px-2 py-2 border-b border-r border-subtle text-left">
                              On
                            </th>
                            <th className="px-2 py-2 border-b border-r border-subtle text-left">
                              Variable
                            </th>
                            <th className="px-2 py-2 border-b border-subtle text-left">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {environmentRows.map((row, index) => (
                            <tr
                              key={row.id}
                              className="border-b border-subtle/60"
                            >
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <button
                                  onClick={() =>
                                    updateEnvironmentRow(
                                      index,
                                      "enabled",
                                      !row.enabled
                                    )
                                  }
                                  className={`h-5 w-5 rounded border inline-flex items-center justify-center ${
                                    row.enabled
                                      ? "border-amber-400 bg-amber-500/15 text-amber-300"
                                      : "border-subtle text-transparent"
                                  }`}
                                >
                                  <Check size={12} />
                                </button>
                              </td>
                              <td className="px-2 py-1.5 border-r border-subtle">
                                <input
                                  className="w-full bg-transparent outline-none"
                                  value={row.key}
                                  onChange={(event) =>
                                    updateEnvironmentRow(
                                      index,
                                      "key",
                                      event.target.value
                                    )
                                  }
                                  placeholder="variable_name"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className="w-full bg-transparent outline-none font-mono"
                                  value={row.value}
                                  onChange={(event) =>
                                    updateEnvironmentRow(
                                      index,
                                      "value",
                                      event.target.value
                                    )
                                  }
                                  placeholder="value"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="rounded-xl border border-subtle bg-surface p-6 text-center max-w-lg">
                    <p className="text-[14px] font-semibold text-primary">
                      No environment selected
                    </p>
                    <p className="text-[12px] text-muted mt-1">
                      Choose an environment from the sidebar or create a new
                      one.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : !selectedRequest ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="w-full max-w-2xl rounded-2xl border border-subtle bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_45%),var(--bg-elevated)] p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-amber-300/80">
                    API Studio
                  </p>
                  <h2 className="text-[22px] font-semibold text-primary leading-tight">
                    {hasCollections
                      ? "Pick a request or create a new one"
                      : "Start by creating your first collection"}
                  </h2>
                  <p className="text-[13px] text-muted">
                    {hasCollections
                      ? "Use the sidebar to open an existing request, or create one in the selected collection."
                      : "Collections keep requests organized. You can also import a Postman JSON file with deeply nested folders."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={createCollection}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/12 px-4 py-3 text-left hover:bg-amber-500/18 transition-colors"
                  >
                    <p className="text-[12px] font-semibold text-amber-200">
                      1. New Collection
                    </p>
                    <p className="text-[11px] text-amber-100/85 mt-1">
                      Create a workspace for related requests.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="rounded-xl border border-subtle bg-surface-2 px-4 py-3 text-left hover:border-amber-500/35 hover:bg-surface transition-colors"
                  >
                    <p className="text-[12px] font-semibold text-primary">
                      2. Import Postman
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      Paste exported collection JSON to import instantly.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={createRequest}
                    disabled={!hasSelectedCollection}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      hasSelectedCollection
                        ? "border-subtle bg-surface-2 hover:border-amber-500/35 hover:bg-surface"
                        : "border-subtle bg-surface-2/50 text-muted cursor-not-allowed"
                    }`}
                  >
                    <p className="text-[12px] font-semibold text-primary">
                      3. New Request
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      {hasSelectedCollection
                        ? "Add and send your first API call."
                        : "Select a collection before creating requests."}
                    </p>
                  </button>
                </div>

                <div className="rounded-xl border border-subtle bg-surface-2 p-3">
                  <p className="text-[12px] text-secondary">
                    Tip: Imported nested folder requests are preserved with full
                    folder path in request names.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-0 p-4 flex flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-3">
                <div className="rounded-lg border border-subtle bg-surface p-3 flex items-center gap-2">
                  <select
                    value={editor.method}
                    onChange={(event) =>
                      updateEditorField("method", event.target.value)
                    }
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
                  <div className="flex-1 min-w-0">
                    <Input
                      value={editor.url}
                      onChange={(event) =>
                        updateEditorField("url", event.target.value)
                      }
                      placeholder="https://api.example.com/v1/users"
                      className="font-mono"
                    />
                    <div className="mt-1.5 rounded border border-subtle bg-surface-2 px-2 py-1.5 text-[11px] font-mono break-all">
                      {urlPreviewSegments.map((segment, index) => (
                        <span
                          key={`${segment.type}-${index}`}
                          title={
                            segment.type === "found"
                              ? `${segment.variableName} = ${segment.variableValue}`
                              : segment.type === "missing"
                              ? `${segment.variableName}: missing value in selected environment`
                              : undefined
                          }
                          className={
                            segment.type === "found"
                              ? "text-blue-300"
                              : segment.type === "missing"
                              ? "text-red-400"
                              : "text-muted"
                          }
                        >
                          {segment.text}
                        </span>
                      ))}
                    </div>
                    {missingUrlVariables.length > 0 ? (
                      <p className="mt-1 text-[11px] text-red-400">
                        Missing variables in URL:{" "}
                        {missingUrlVariables.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={running}
                    icon={<Play size={12} />}
                    onClick={runRequest}
                  >
                    Send
                  </Button>
                </div>

                <div className="rounded-lg border border-subtle bg-surface overflow-hidden">
                  <div className="px-3 py-2 border-b border-subtle flex items-center justify-between">
                    <Input
                      label="Request Name"
                      value={editor.name}
                      onChange={(event) =>
                        updateEditorField("name", event.target.value)
                      }
                      className="w-[320px]"
                    />

                    <div className="flex items-center gap-2 pt-5">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Save size={12} />}
                        onClick={() => void saveCurrentRequest()}
                        disabled={
                          !canEdit || !isDirty || saveState === "saving"
                        }
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
                        {tab.hasConfiguredData ? (
                          <span
                            className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                            title="Contains configured values"
                          />
                        ) : null}
                        {typeof tab.count === "number" ? (
                          <span className="ml-1 text-[11px] text-green-400">
                            ({tab.count})
                          </span>
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
                              <th className="w-12 px-2 py-2 border-b border-r border-subtle text-left">
                                On
                              </th>
                              <th className="px-2 py-2 border-b border-r border-subtle text-left">
                                Key
                              </th>
                              <th className="px-2 py-2 border-b border-r border-subtle text-left">
                                Value
                              </th>
                              <th className="px-2 py-2 border-b border-subtle text-left">
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {editor.paramsRows.map((row, index) => (
                              <tr
                                key={row.id}
                                className="border-b border-subtle/60"
                              >
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <button
                                    onClick={() =>
                                      updateRows(
                                        "paramsRows",
                                        index,
                                        "enabled",
                                        !row.enabled
                                      )
                                    }
                                    className={`h-5 w-5 rounded border inline-flex items-center justify-center ${
                                      row.enabled
                                        ? "border-amber-400 bg-amber-500/15 text-amber-300"
                                        : "border-subtle text-transparent"
                                    }`}
                                  >
                                    <Check size={12} />
                                  </button>
                                </td>
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.key}
                                    onChange={(e) =>
                                      updateRows(
                                        "paramsRows",
                                        index,
                                        "key",
                                        e.target.value
                                      )
                                    }
                                    placeholder="key"
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.value}
                                    onChange={(e) =>
                                      updateRows(
                                        "paramsRows",
                                        index,
                                        "value",
                                        e.target.value
                                      )
                                    }
                                    placeholder="value"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.description}
                                    onChange={(e) =>
                                      updateRows(
                                        "paramsRows",
                                        index,
                                        "description",
                                        e.target.value
                                      )
                                    }
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
                              <th className="w-12 px-2 py-2 border-b border-r border-subtle text-left">
                                On
                              </th>
                              <th className="px-2 py-2 border-b border-r border-subtle text-left">
                                Key
                              </th>
                              <th className="px-2 py-2 border-b border-r border-subtle text-left">
                                Value
                              </th>
                              <th className="px-2 py-2 border-b border-subtle text-left">
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {editor.headersRows.map((row, index) => (
                              <tr
                                key={row.id}
                                className="border-b border-subtle/60"
                              >
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <button
                                    onClick={() =>
                                      updateRows(
                                        "headersRows",
                                        index,
                                        "enabled",
                                        !row.enabled
                                      )
                                    }
                                    className={`h-5 w-5 rounded border inline-flex items-center justify-center ${
                                      row.enabled
                                        ? "border-amber-400 bg-amber-500/15 text-amber-300"
                                        : "border-subtle text-transparent"
                                    }`}
                                  >
                                    <Check size={12} />
                                  </button>
                                </td>
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.key}
                                    onChange={(e) =>
                                      updateRows(
                                        "headersRows",
                                        index,
                                        "key",
                                        e.target.value
                                      )
                                    }
                                    placeholder="key"
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-r border-subtle">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.value}
                                    onChange={(e) =>
                                      updateRows(
                                        "headersRows",
                                        index,
                                        "value",
                                        e.target.value
                                      )
                                    }
                                    placeholder="value"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    className="w-full bg-transparent outline-none"
                                    value={row.description}
                                    onChange={(e) =>
                                      updateRows(
                                        "headersRows",
                                        index,
                                        "description",
                                        e.target.value
                                      )
                                    }
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
                          <label className="text-[12px] text-muted mb-1 block">
                            Auth Type
                          </label>
                          <select
                            className="h-10 w-full rounded-md border border-subtle bg-surface-2 px-3 text-[12px]"
                            value={editor.authType}
                            onChange={(e) =>
                              updateEditorField(
                                "authType",
                                e.target.value as AuthType
                              )
                            }
                          >
                            <option value="none">No Auth</option>
                            <option value="bearer">Bearer Token</option>
                          </select>
                        </div>

                        {editor.authType === "bearer" ? (
                          <Input
                            label="Token"
                            value={editor.authToken}
                            onChange={(e) =>
                              updateEditorField("authToken", e.target.value)
                            }
                            placeholder="{{token}}"
                            className="font-mono"
                          />
                        ) : null}
                      </div>
                    )}

                    {activeTab === "body" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-semibold text-primary">
                            Raw Body (JSON)
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={formatBodyAsJson}
                            disabled={!editor.bodyText.trim()}
                          >
                            Format JSON
                          </Button>
                        </div>

                        <JsonCodeEditor
                          value={editor.bodyText}
                          onChange={(nextValue) =>
                            updateEditorField("bodyText", nextValue)
                          }
                          onValidationChange={setBodyValidationError}
                          minHeight={320}
                          maxHeight={520}
                        />

                        {bodyValidationError ? (
                          <p className="text-[11px] text-red-400">
                            Invalid JSON: {bodyValidationError}. Hover the red
                            error marker in the editor for details.
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted">
                            JSON is valid. Body variables like {"{{token}}"} are
                            supported.
                          </p>
                        )}
                      </div>
                    )}

                    {activeTab === "scripts" && (
                      <div className="space-y-3">
                        <div className="rounded-md border border-subtle bg-surface-2 p-3 space-y-2">
                          <p className="text-[12px] font-semibold text-primary">
                            Script helper
                          </p>
                          <p className="text-[11px] text-muted">
                            Pre-request scripts run before request is sent.
                            Tests scripts run after response is received.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                              Use{" "}
                              <span className="font-mono text-primary">
                                pm.environment.set
                              </span>{" "}
                              to store variables.
                            </div>
                            <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                              Use{" "}
                              <span className="font-mono text-primary">
                                {"{{name}}"}
                              </span>{" "}
                              variables in URL, headers, and body.
                            </div>
                            <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                              Use{" "}
                              <span className="font-mono text-primary">
                                pm.response
                              </span>{" "}
                              only in Tests script.
                            </div>
                            <div className="rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary">
                              Use{" "}
                              <span className="font-mono text-primary">
                                pm.test
                              </span>{" "}
                              and{" "}
                              <span className="font-mono text-primary">
                                pm.expect
                              </span>{" "}
                              for assertions.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {SCRIPT_SUGGESTIONS.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="text-[11px] rounded-md border border-subtle bg-surface px-2 py-1.5 text-secondary hover:text-primary hover:border-amber-500/40"
                                onClick={() =>
                                  insertScriptSuggestion(
                                    item.appliesTo,
                                    item.snippet
                                  )
                                }
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
                          onChange={(e) =>
                            updateEditorField(
                              "preRequestScript",
                              e.target.value
                            )
                          }
                          className="font-mono"
                          placeholder="// pre request script"
                        />
                        <Textarea
                          label="Tests Script"
                          rows={7}
                          value={editor.testsScript}
                          onChange={(e) =>
                            updateEditorField("testsScript", e.target.value)
                          }
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
                        <p>
                          Environment variables in all fields are supported with
                          double braces.
                        </p>
                        <p className="font-mono text-secondary">
                          Example: {"{{token}}"} or{" "}
                          {"https://api.example.com/{{version}}"}
                        </p>
                        <p>
                          Edit save shortcut from{" "}
                          <Link
                            className="text-amber-400"
                            href="/dashboard/settings"
                          >
                            Settings
                          </Link>
                          .
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
              </div>

              <div
                className="rounded-lg border border-subtle bg-surface overflow-hidden flex flex-col min-h-0"
                style={{ height: `${responsePanelHeight}px` }}
              >
                <div
                  className={`h-2 cursor-row-resize ${
                    isDraggingResponse
                      ? "bg-amber-500/30"
                      : "bg-transparent hover:bg-amber-500/20"
                  }`}
                  onMouseDown={beginResponseResize}
                  title="Drag to resize response panel"
                />
                <div className="px-3 py-2 border-b border-subtle flex items-center justify-between">
                  <p className="text-[12px] font-semibold">Response</p>
                  {responseView?.status ? (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Badge variant="success">{responseView.status}</Badge>
                      <span className="text-muted">
                        {formatResponseDuration(responseView.durationMs)}
                      </span>
                      <span className="text-muted">•</span>
                      <span className="text-muted">
                        {formatResponseSize(responseView.sizeBytes)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="px-3 h-10 border-b border-subtle flex items-center gap-5 text-[12px] overflow-x-auto">
                  <button
                    className={`pb-1.5 border-b-2 ${
                      responsePanelTab === "body"
                        ? "border-amber-400 text-primary"
                        : "border-transparent text-muted hover:text-secondary"
                    }`}
                    onClick={() => setResponsePanelTab("body")}
                  >
                    Body
                  </button>
                  <button
                    className={`pb-1.5 border-b-2 ${
                      responsePanelTab === "headers"
                        ? "border-amber-400 text-primary"
                        : "border-transparent text-muted hover:text-secondary"
                    }`}
                    onClick={() => setResponsePanelTab("headers")}
                  >
                    Headers ({responseHeadersList.length})
                  </button>
                  <button
                    className={`pb-1.5 border-b-2 ${
                      responsePanelTab === "tests"
                        ? "border-amber-400 text-primary"
                        : "border-transparent text-muted hover:text-secondary"
                    }`}
                    onClick={() => setResponsePanelTab("tests")}
                  >
                    Test Results ({passedTestsCount}/
                    {responseTestResults.length})
                  </button>
                </div>

                <div className="p-3 min-h-0 flex-1 overflow-hidden">
                  {responseView?.error ? (
                    <div
                      className="space-y-3 overflow-auto"
                      style={{ maxHeight: `${responseContentMaxHeight}px` }}
                    >
                      <pre className="text-[11px] text-red-400 whitespace-pre-wrap break-words">
                        {responseView.error}
                      </pre>
                      {responseView.localAgent?.isLocalTarget &&
                      !responseView.localAgent.running ? (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] space-y-2">
                          <p className="text-amber-300 font-medium">
                            Local agent appears to be offline
                          </p>
                          <p className="text-muted">
                            Start your local agent, then run this request again.
                          </p>
                          <div className="rounded border border-subtle bg-surface-2 p-2">
                            <p className="text-secondary mb-1">Start command</p>
                            <code className="text-[11px] text-primary break-all">
                              {responseView.localAgent.startCommand}
                            </code>
                          </div>
                          <div className="rounded border border-subtle bg-surface-2 p-2">
                            <p className="text-secondary mb-1">Health check</p>
                            <code className="text-[11px] text-primary break-all">
                              {responseView.localAgent.healthCommand}
                            </code>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : responseView ? (
                    <>
                      {responsePanelTab === "body" && (
                        <JsonCodeEditor
                          value={
                            normalizedResponseData === undefined
                              ? ""
                              : JSON.stringify(normalizedResponseData, null, 2)
                          }
                          onChange={() => undefined}
                          minHeight={280}
                          maxHeight={responseContentMaxHeight}
                          readOnly
                          enableLint={false}
                        />
                      )}

                      {responsePanelTab === "headers" && (
                        <div
                          className="rounded-md border border-subtle overflow-hidden overflow-y-auto"
                          style={{ maxHeight: `${responseContentMaxHeight}px` }}
                        >
                          <table className="w-full text-[12px]">
                            <thead className="bg-surface-2 text-muted">
                              <tr>
                                <th className="px-2 py-2 border-b border-r border-subtle text-left w-[35%]">
                                  Header
                                </th>
                                <th className="px-2 py-2 border-b border-subtle text-left">
                                  Value
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {responseHeadersList.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={2}
                                    className="px-2 py-3 text-muted text-center"
                                  >
                                    No response headers
                                  </td>
                                </tr>
                              ) : (
                                responseHeadersList.map(([key, value]) => (
                                  <tr
                                    key={key}
                                    className="border-b border-subtle/60"
                                  >
                                    <td className="px-2 py-1.5 border-r border-subtle text-secondary font-mono">
                                      {key}
                                    </td>
                                    <td className="px-2 py-1.5 text-muted break-all">
                                      {value}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {responsePanelTab === "tests" && (
                        <div
                          className="space-y-2 overflow-y-auto pr-1"
                          style={{ maxHeight: `${responseContentMaxHeight}px` }}
                        >
                          <div className="rounded-md border border-subtle bg-surface-2 p-2 text-[11px]">
                            <p className="text-secondary">
                              Pre-request:{" "}
                              {responseView.scripts?.preRequest?.runtimeError
                                ? "error"
                                : "ok"}
                            </p>
                            {responseView.scripts?.preRequest?.runtimeError ? (
                              <p className="text-red-400 mt-1">
                                {responseView.scripts.preRequest.runtimeError}
                              </p>
                            ) : null}
                          </div>
                          <div className="rounded-md border border-subtle bg-surface-2 p-2 text-[11px]">
                            <p className="text-secondary mb-1">
                              Tests: {passedTestsCount}/
                              {responseTestResults.length} passed
                            </p>
                            {responseView.scripts?.tests?.runtimeError ? (
                              <p className="text-red-400 mb-1">
                                Runtime error:{" "}
                                {responseView.scripts.tests.runtimeError}
                              </p>
                            ) : null}
                            <div className="space-y-1 max-h-52 overflow-auto">
                              {responseTestResults.length === 0 ? (
                                <p className="text-muted">No tests executed.</p>
                              ) : (
                                responseTestResults.map((test, index) => (
                                  <div
                                    key={`${test.name}-${index}`}
                                    className="rounded border border-subtle px-2 py-1"
                                  >
                                    <p
                                      className={
                                        test.passed
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {test.passed ? "PASS" : "FAIL"} -{" "}
                                      {test.name}
                                    </p>
                                    {!test.passed && test.error ? (
                                      <p className="text-muted mt-0.5">
                                        {test.error}
                                      </p>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-muted">
                      Run request to view response
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setImportOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-surface border border-subtle rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-primary">
                Import Postman Collection JSON
              </h3>
              <button
                className="text-muted hover:text-primary"
                onClick={() => setImportOpen(false)}
              >
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(false)}
              >
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

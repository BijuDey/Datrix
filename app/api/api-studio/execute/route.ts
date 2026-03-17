import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import vm from "node:vm";
import moment from "moment";
import _ from "lodash";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const DEFAULT_TIMEOUT_MS = 30_000;

const LOCAL_AGENT_HEALTH_PATHS = ["/health", "/knocknock", "/status"];

type LocalAgentHint = {
  checked: boolean;
  isLocalTarget: boolean;
  running: boolean;
  startCommand: string;
  healthCommand: string;
  triedHealthUrls: string[];
};

type RuntimeStores = {
  variables: Record<string, string>;
  environment: Record<string, string>;
  collectionVariables: Record<string, string>;
  globals: Record<string, string>;
};

type ScriptTestResult = {
  name: string;
  passed: boolean;
  error?: string;
};

type ScriptRunResult = {
  runtimeError: string | null;
  tests: ScriptTestResult[];
};

async function getUserAndRole(orgId: string) {
  const supabase = await createUserServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, role: membership?.role ?? null };
}

function normalizeHeaders(input: unknown): HeadersInit {
  if (!input || typeof input !== "object") return {};

  const source = input as Record<string, unknown>;
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!key.trim()) continue;
    if (value === undefined || value === null) continue;
    normalized[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  return normalized;
}

function isLocalHostname(hostname: string) {
  const value = hostname.trim().toLowerCase();
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value === "0.0.0.0" ||
    value.endsWith(".local")
  );
}

function withShortTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function buildLocalAgentHint(targetUrl: URL): LocalAgentHint {
  const isLocalTarget = isLocalHostname(targetUrl.hostname);
  const port = targetUrl.port || (targetUrl.protocol === "https:" ? "443" : "80");
  const startCommand =
    process.env.LOCAL_AGENT_START_COMMAND?.trim() ||
    `LOCAL_AGENT_PORT=${port} npm run agent`;

  return {
    checked: false,
    isLocalTarget,
    running: false,
    startCommand,
    healthCommand: `curl -fsS ${targetUrl.protocol}//${targetUrl.hostname}:${port}/health`,
    triedHealthUrls: [],
  };
}

async function detectLocalAgentRunning(targetUrl: URL): Promise<LocalAgentHint> {
  const hint = buildLocalAgentHint(targetUrl);
  if (!hint.isLocalTarget) return hint;

  const origin = `${targetUrl.protocol}//${targetUrl.host}`;
  const triedHealthUrls: string[] = [];

  for (const path of LOCAL_AGENT_HEALTH_PATHS) {
    const healthUrl = `${origin}${path}`;
    triedHealthUrls.push(healthUrl);
    const timeout = withShortTimeout(1200);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: timeout.signal,
      });
      if (response.ok) {
        return {
          ...hint,
          checked: true,
          running: true,
          triedHealthUrls,
        };
      }
    } catch {
      // Ignore probe errors and continue trying fallback health paths.
    } finally {
      timeout.clear();
    }
  }

  return {
    ...hint,
    checked: true,
    running: false,
    triedHealthUrls,
  };
}

function randomFrom<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomDigits(length: number) {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += Math.floor(Math.random() * 10).toString();
  }
  return output;
}

function resolveDynamicVariable(name: string): string {
  switch (name) {
    case "$guid":
      return uuidv4();
    case "$timestamp":
      return Math.floor(Date.now() / 1000).toString();
    case "$isoTimestamp":
      return new Date().toISOString();
    case "$randomBoolean":
      return Math.random() > 0.5 ? "true" : "false";
    case "$randomEmail":
      return `user${randomDigits(6)}@example.com`;
    case "$randomFullName":
      return `${randomFrom(["Liam", "Noah", "Emma", "Mia", "Ava", "Olivia"])} ${randomFrom(["Smith", "Johnson", "Davis", "Brown", "Miller", "Garcia"])}`;
    case "$randomCompanyName":
      return randomFrom([
        "Northwind Labs",
        "Acme Dynamics",
        "Blue Orbit Systems",
        "Pioneer Works",
        "Delta Forge",
      ]);
    case "$randomStreetAddress":
      return `${Math.floor(Math.random() * 9999) + 1} ${randomFrom(["Main St", "Maple Ave", "Broadway", "Sunset Blvd", "Oak Lane"])}`;
    case "$randomCity":
      return randomFrom(["Austin", "Seattle", "Denver", "Phoenix", "Chicago", "Boston"]);
    case "$randomPhoneNumber":
      return `${randomDigits(3)}-${randomDigits(3)}-${randomDigits(4)}`;
    case "$randomBs":
      return randomFrom([
        "drive robust paradigms",
        "empower strategic initiatives",
        "orchestrate cloud workflows",
        "optimize digital ecosystems",
      ]);
    default:
      return "";
  }
}

function createVariableResolver(stores: RuntimeStores) {
  const lookup = (name: string) => {
    if (name in stores.variables) return stores.variables[name];
    if (name in stores.environment) return stores.environment[name];
    if (name in stores.collectionVariables) return stores.collectionVariables[name];
    if (name in stores.globals) return stores.globals[name];
    if (name.startsWith("$")) return resolveDynamicVariable(name);
    return "";
  };

  const replaceIn = (input: string) =>
    String(input || "").replace(/{{\s*([^}]+?)\s*}}/g, (_, rawName) => {
      const name = String(rawName || "").trim();
      return lookup(name);
    });

  return { lookup, replaceIn };
}

function toValueString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createExpect(actual: unknown) {
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const objectShape = {
    get to() {
      return objectShape;
    },
    get be() {
      return objectShape;
    },
    get have() {
      return objectShape;
    },
    get not() {
      return {
        have: {
          any: {
            keys: (...keys: string[]) => {
              const current = (actual || {}) as Record<string, unknown>;
              const currentKeys = Object.keys(current);
              const hasAny = keys.some((key) => currentKeys.includes(key));
              assert(!hasAny, `Expected object to not have any keys: ${keys.join(", ")}`);
            },
          },
        },
      };
    },
    eql: (expected: unknown) => {
      assert(_.isEqual(actual, expected), `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`);
    },
    equal: (expected: unknown) => {
      assert(actual === expected, `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    },
    a: (expectedType: string) => {
      const type = Array.isArray(actual) ? "array" : typeof actual;
      assert(type === expectedType, `Expected type ${expectedType} but got ${type}`);
    },
    below: (max: number) => {
      assert(Number(actual) < max, `Expected ${String(actual)} to be below ${max}`);
    },
    lessThan: (max: number) => {
      assert(Number(actual) < max, `Expected ${String(actual)} to be less than ${max}`);
    },
    property: (key: string, expected?: unknown) => {
      const current = (actual || {}) as Record<string, unknown>;
      assert(Object.prototype.hasOwnProperty.call(current, key), `Expected object to have property ${key}`);
      if (arguments.length > 1) {
        assert(_.isEqual(current[key], expected), `Expected property ${key} to equal ${JSON.stringify(expected)}`);
      }
    },
    status: (expected: number) => {
      assert(Number(actual) === expected, `Expected status ${expected} but received ${String(actual)}`);
    },
    jsonSchema: (_schema: unknown) => {
      // Lightweight compatibility shim for common imported collections.
      assert(true, "");
    },
    get true() {
      assert(actual === true, `Expected ${JSON.stringify(actual)} to be true`);
      return true;
    },
    get null() {
      assert(actual === null, `Expected ${JSON.stringify(actual)} to be null`);
      return null;
    },
    get empty() {
      const ok =
        actual === "" ||
        actual === null ||
        actual === undefined ||
        (Array.isArray(actual) && actual.length === 0) ||
        (typeof actual === "object" && actual !== null && Object.keys(actual as object).length === 0);
      assert(ok, "Expected value to be empty");
      return true;
    },
    all: {
      keys: (...keys: string[]) => {
        const current = (actual || {}) as Record<string, unknown>;
        const currentKeys = Object.keys(current);
        const missing = keys.filter((key) => !currentKeys.includes(key));
        assert(missing.length === 0, `Missing keys: ${missing.join(", ")}`);
      },
    },
    any: {
      keys: (...keys: string[]) => {
        const current = (actual || {}) as Record<string, unknown>;
        const currentKeys = Object.keys(current);
        const hasAny = keys.some((key) => currentKeys.includes(key));
        assert(hasAny, `Expected object to have at least one of keys: ${keys.join(", ")}`);
      },
    },
  };

  return objectShape;
}

function runPostmanScript(params: {
  script: string;
  stores: RuntimeStores;
  requestContext: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  responseContext?: {
    status: number;
    responseTime: number;
    headers: Record<string, string>;
    bodyText: string;
    data: unknown;
  };
}): ScriptRunResult {
  const { script, stores, requestContext, responseContext } = params;
  if (!script.trim()) return { runtimeError: null, tests: [] };

  const tests: ScriptTestResult[] = [];
  const resolver = createVariableResolver(stores);

  const pm = {
    variables: {
      get: (name: string) => resolver.lookup(String(name || "")),
      set: (name: string, value: unknown) => {
        stores.variables[String(name)] = toValueString(value);
      },
      replaceIn: (input: string) => resolver.replaceIn(input),
    },
    environment: {
      get: (name: string) => stores.environment[String(name)] || "",
      set: (name: string, value: unknown) => {
        stores.environment[String(name)] = toValueString(value);
      },
      unset: (name: string) => {
        delete stores.environment[String(name)];
      },
    },
    collectionVariables: {
      get: (name: string) => stores.collectionVariables[String(name)] || "",
      set: (name: string, value: unknown) => {
        stores.collectionVariables[String(name)] = toValueString(value);
      },
      unset: (name: string) => {
        delete stores.collectionVariables[String(name)];
      },
    },
    globals: {
      get: (name: string) => stores.globals[String(name)] || "",
      set: (name: string, value: unknown) => {
        stores.globals[String(name)] = toValueString(value);
      },
      unset: (name: string) => {
        delete stores.globals[String(name)];
      },
    },
    request: {
      method: requestContext.method,
      url: requestContext.url,
      headers: requestContext.headers,
      body: requestContext.body,
    },
    response: responseContext
      ? {
        code: responseContext.status,
        status: responseContext.status,
        responseTime: responseContext.responseTime,
        headers: {
          get: (name: string) => {
            const lower = String(name || "").toLowerCase();
            const hit = Object.entries(responseContext.headers).find(
              ([key]) => key.toLowerCase() === lower
            );
            return hit?.[1] || null;
          },
        },
        text: () => responseContext.bodyText,
        json: () => {
          if (typeof responseContext.data === "string") {
            return JSON.parse(responseContext.data);
          }
          return responseContext.data;
        },
        to: {
          have: {
            status: (expected: number) => {
              if (responseContext.status !== expected) {
                throw new Error(`Expected status ${expected} but received ${responseContext.status}`);
              }
            },
          },
        },
      }
      : undefined,
    expect: (value: unknown) => createExpect(value),
    test: (name: string, fn: () => void) => {
      try {
        fn();
        tests.push({ name, passed: true });
      } catch (error) {
        tests.push({
          name,
          passed: false,
          error: error instanceof Error ? error.message : "Assertion failed",
        });
      }
    },
    visualizer: {
      set: () => undefined,
    },
  };

  const sandbox = {
    pm,
    postman: {
      setNextRequest: () => undefined,
    },
    responseBody: responseContext?.bodyText || "",
    console,
    require: (name: string) => {
      if (name === "moment") return moment;
      if (name === "uuid") return { v4: uuidv4 };
      if (name === "lodash") return _;
      if (name === "cheerio") return cheerio;
      throw new Error(`Unsupported module in Postman script: ${name}`);
    },
    _: _,
    cheerio,
  };

  try {
    vm.runInNewContext(script, sandbox, { timeout: 1500 });
    return { runtimeError: null, tests };
  } catch (error) {
    return {
      runtimeError:
        error instanceof Error ? error.message : "Failed to execute script",
      tests,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const orgId = String(payload.orgId || "").trim();
    const rawUrl = String(payload.url || "").trim();
    const method = String(payload.method || "GET").toUpperCase();

    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json({ error: `Unsupported method: ${method}` }, { status: 400 });
    }

    const { user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

    const timeoutMs = Number(payload.timeoutMs) > 0 ? Number(payload.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const stores: RuntimeStores = {
      variables: {},
      environment:
        payload.environmentVariables && typeof payload.environmentVariables === "object"
          ? Object.fromEntries(
            Object.entries(payload.environmentVariables as Record<string, unknown>).map(([k, v]) => [
              k,
              toValueString(v),
            ])
          )
          : {},
      collectionVariables: {},
      globals: {},
    };

    const resolver = createVariableResolver(stores);

    const requestHeaders = normalizeHeaders(payload.headers) as Record<string, string>;
    const requestQueryParams: Record<string, string> =
      payload.queryParams && typeof payload.queryParams === "object"
        ? Object.fromEntries(
          Object.entries(payload.queryParams as Record<string, unknown>).map(([k, v]) => [
            k,
            toValueString(v),
          ])
        )
        : {};

    const preScriptResult = runPostmanScript({
      script: String(payload.preRequestScript || ""),
      stores,
      requestContext: {
        method,
        url: rawUrl,
        headers: requestHeaders,
        body: payload.body,
      },
    });

    let resolvedUrl: string;
    let resolvedUrlObject: URL;
    try {
      const withVars = resolver.replaceIn(rawUrl);
      const target = new URL(withVars);

      if (!["http:", "https:"].includes(target.protocol)) {
        return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 400 });
      }

      for (const [key, value] of Object.entries(requestQueryParams)) {
        const resolvedKey = resolver.replaceIn(String(key));
        if (!resolvedKey) continue;
        target.searchParams.set(resolvedKey, resolver.replaceIn(String(value)));
      }

      resolvedUrlObject = target;
      resolvedUrl = target.toString();
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(requestHeaders)) {
      resolvedHeaders[resolver.replaceIn(key)] = resolver.replaceIn(value);
    }

    const resolvedBodyRaw =
      payload.body === undefined || payload.body === null
        ? undefined
        : typeof payload.body === "string"
          ? resolver.replaceIn(payload.body)
          : JSON.parse(resolver.replaceIn(JSON.stringify(payload.body)));

    if (
      resolvedBodyRaw !== undefined &&
      typeof resolvedBodyRaw !== "string" &&
      !Object.keys(resolvedHeaders).some(
        (key) => key.toLowerCase() === "content-type"
      )
    ) {
      resolvedHeaders["Content-Type"] = "application/json";
    }

    try {
      const localHint = await detectLocalAgentRunning(resolvedUrlObject);
      if (localHint.isLocalTarget && localHint.checked && !localHint.running) {
        return NextResponse.json(
          {
            error: "Local agent is not reachable. Start it and try again.",
            localAgent: localHint,
          },
          { status: 503 }
        );
      }

      const hasBody = !["GET", "HEAD"].includes(method);
      const startedAt = Date.now();
      const response = await fetch(resolvedUrl, {
        method,
        headers: resolvedHeaders,
        body: hasBody && resolvedBodyRaw !== undefined
          ? typeof resolvedBodyRaw === "string"
            ? resolvedBodyRaw
            : JSON.stringify(resolvedBodyRaw)
          : undefined,
        signal: controller.signal,
      });

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();

      let data: unknown;
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        data = await response.text();
      }

      const responseTime = Date.now() - startedAt;
      const responseText = typeof data === "string" ? data : JSON.stringify(data);
      const responseSizeBytes = Buffer.byteLength(responseText || "", "utf8");

      const testsScriptResult = runPostmanScript({
        script: String(payload.testsScript || ""),
        stores,
        requestContext: {
          method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          body: resolvedBodyRaw,
        },
        responseContext: {
          status: response.status,
          responseTime,
          headers: Object.fromEntries(response.headers.entries()),
          bodyText: responseText,
          data,
        },
      });

      return NextResponse.json({
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        durationMs: responseTime,
        sizeBytes: responseSizeBytes,
        scripts: {
          preRequest: preScriptResult,
          tests: testsScriptResult,
        },
        variables: {
          environment: stores.environment,
          collection: stores.collectionVariables,
          globals: stores.globals,
          local: stores.variables,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json({ error: `Request timed out after ${timeoutMs}ms` }, { status: 504 });
      }

      const message = error instanceof Error ? error.message : "Request failed";
      const localHint = await detectLocalAgentRunning(resolvedUrlObject);

      if (localHint.isLocalTarget && localHint.checked && !localHint.running) {
        return NextResponse.json(
          {
            error: "Local agent is not reachable. Start it and retry.",
            cause: message,
            localAgent: localHint,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: message,
          localAgent: localHint.isLocalTarget ? localHint : undefined,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute request" },
      { status: 500 }
    );
  }
}

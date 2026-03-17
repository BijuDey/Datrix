"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  indentWithTab,
  lineComment,
  lineUncomment,
  toggleComment,
} from "@codemirror/commands";

type JsonCodeEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  onValidationChange?: (errorMessage: string | null) => void;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  readOnly?: boolean;
  enableLint?: boolean;
};

type JsonValidationIssue = {
  message: string;
  from: number;
  to: number;
};

function sanitizeJsonLikeInput(input: string) {
  const chars = input.split("");
  let inString = false;
  let escaped = false;

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1] || "";

    if (!inString && current === "/" && next === "/") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i += 1;
      }
      i -= 1;
      continue;
    }

    if (!inString && current === "{" && next === "{") {
      const start = i;
      let end = i + 2;
      while (end < chars.length - 1) {
        if (chars[end] === "}" && chars[end + 1] === "}") {
          break;
        }
        end += 1;
      }

      if (end < chars.length - 1) {
        chars[start] = "0";
        for (let k = start + 1; k <= end + 1; k += 1) {
          chars[k] = " ";
        }
        i = end + 1;
        continue;
      }
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
    }
  }

  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== ",") continue;

    let j = i + 1;
    while (j < chars.length) {
      const ch = chars[j];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        j += 1;
        continue;
      }
      break;
    }

    if (j < chars.length && (chars[j] === "}" || chars[j] === "]")) {
      chars[i] = " ";
    }
  }

  return chars.join("");
}

function extractJsonPosition(message: string) {
  const match = /position\s+(\d+)/i.exec(message);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function validateJsonLike(content: string): JsonValidationIssue | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const sanitized = sanitizeJsonLikeInput(content);

  try {
    JSON.parse(sanitized);
    return null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON body";
    const position = extractJsonPosition(message);

    if (position === null) {
      return {
        message,
        from: 0,
        to: Math.min(1, content.length),
      };
    }

    const from = Math.max(0, Math.min(position, content.length));
    return {
      message,
      from,
      to: Math.min(from + 1, content.length),
    };
  }
}

export function JsonCodeEditor({
  value,
  onChange,
  onValidationChange,
  minHeight = 280,
  maxHeight,
  className,
  readOnly = false,
  enableLint = true,
}: JsonCodeEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorView | null>(null);
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onValidationChangeRef = useRef(onValidationChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  function validateJson(content: string) {
    const issue = validateJsonLike(content);
    if (!issue) {
      onValidationChangeRef.current?.(null);
      return;
    }

    onValidationChangeRef.current?.(issue.message);
  }

  useEffect(() => {
    if (!rootRef.current || editorRef.current) return;

    const toggleLineComments = (view: EditorView) => {
      return lineComment(view) || lineUncomment(view) || toggleComment(view);
    };

    const tolerantJsonLinter = linter((view): Diagnostic[] => {
      if (!enableLint) return [];
      const issue = validateJsonLike(view.state.doc.toString());
      if (!issue) return [];

      return [
        {
          from: issue.from,
          to: issue.to,
          severity: "error",
          message: issue.message,
        },
      ];
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        closeBrackets(),
        oneDark,
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorState.languageData.of(() => [{ commentTokens: { line: "//" } }]),
        lintGutter(),
        tolerantJsonLinter,
        keymap.of([
          { key: "Mod-/", run: toggleLineComments },
          { key: "Mod-Shift-7", run: toggleLineComments },
          indentWithTab,
          ...closeBracketsKeymap,
        ]),
        EditorView.theme({
          "&": {
            fontSize: "13px",
            backgroundColor: "var(--bg-elevated)",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-light)",
          },
          ".cm-content": {
            minHeight: `${minHeight}px`,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
          ".cm-scroller": {
            overflow: "auto",
            maxHeight: maxHeight ? `${maxHeight}px` : "none",
          },
          ".cm-gutters": {
            backgroundColor: "var(--bg-subtle)",
            color: "var(--text-muted)",
            borderRight: "1px solid var(--border-light)",
            borderTopLeftRadius: "0.5rem",
            borderBottomLeftRadius: "0.5rem",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(245, 158, 11, 0.08)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "rgba(245, 158, 11, 0.08)",
          },
          ".cm-tooltip.cm-tooltip-lint": {
            border: "1px solid var(--border-light)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (syncingRef.current) return;
          if (readOnly) return;

          const nextValue = update.state.doc.toString();
          onChangeRef.current(nextValue);
          validateJson(nextValue);
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: rootRef.current,
    });

    editorRef.current = view;
    validateJson(value);

    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, [enableLint, maxHeight, minHeight, readOnly]);

  useEffect(() => {
    const view = editorRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;

    const head = view.state.selection.main.head;
    syncingRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
      selection: {
        anchor: Math.min(head, value.length),
      },
    });
    syncingRef.current = false;

    validateJson(value);
  }, [value]);

  return <div ref={rootRef} className={className} />;
}

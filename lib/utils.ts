import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format bytes to human-readable */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

/** Format duration in ms to human-readable */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/** Format relative time */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/** Truncate a string */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

/** Generate a random ID */
export function nanoid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Get initials from a name */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Sleep */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

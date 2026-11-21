/**
 * Light / dark theme (Roleplay+). Light is the default look, dark follows the
 * system until the user picks one. The inline script in index.html applies the
 * stored choice before first paint; this module keeps it in sync afterwards.
 */

import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "atelier:theme";
const listeners = new Set<() => void>();

function stored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function apply(mode: ThemeMode): void {
  const theme = resolve(mode);
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.classList.toggle("dark", theme === "dark");
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable */
  }
  apply(mode);
  listeners.forEach((l) => l());
}

export function getTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
  );
}

export function initTheme(): void {
  apply(stored());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (stored() === "system") {
      apply("system");
      listeners.forEach((l) => l());
    }
  });
}

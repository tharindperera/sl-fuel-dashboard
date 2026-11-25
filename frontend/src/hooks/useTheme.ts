import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem("cpc-theme");
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      window.localStorage.setItem("cpc-theme", theme);
    } catch {
      // Ignore storage quota or private browsing errors.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}

import { createContext, useContext, useEffect } from "react";

export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "climpire_theme";

interface ThemeContextValue {
  theme: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
});

// The Bigital design system ships a single dark theme; a previously stored "light" choice is discarded.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: ThemeMode = "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

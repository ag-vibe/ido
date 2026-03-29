export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = Exclude<ThemeMode, "auto">;

export const THEME_STORAGE_KEY = "theme";
export const LIGHT_THEME_CHROME = "#f3f1ea";
export const DARK_THEME_CHROME = "#1c1b1a";

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  return mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
}

function getThemeColor(resolved: ResolvedTheme): string {
  return resolved === "dark" ? DARK_THEME_CHROME : LIGHT_THEME_CHROME;
}

function upsertMeta(name: string): HTMLMetaElement | null {
  if (typeof document === "undefined") return null;
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  return meta;
}

function syncThemeChrome(resolved: ResolvedTheme): void {
  upsertMeta("theme-color")?.setAttribute("content", getThemeColor(resolved));
  upsertMeta("apple-mobile-web-app-status-bar-style")?.setAttribute(
    "content",
    resolved === "dark" ? "black-translucent" : "default",
  );
}

export function applyThemeMode(mode: ThemeMode): ResolvedTheme {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveThemeMode(mode, prefersDark);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    if (mode === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
    root.style.colorScheme = resolved;
    syncThemeChrome(resolved);
  }

  return resolved;
}

export function getThemeInitScript(): string {
  return `(function(){try{var key='${THEME_STORAGE_KEY}';var stored=window.localStorage.getItem(key);var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;var themeMeta=document.querySelector('meta[name="theme-color"]');if(!themeMeta){themeMeta=document.createElement('meta');themeMeta.setAttribute('name','theme-color');document.head.appendChild(themeMeta)}themeMeta.setAttribute('content',resolved==='dark'?'${DARK_THEME_CHROME}':'${LIGHT_THEME_CHROME}');var statusMeta=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(!statusMeta){statusMeta=document.createElement('meta');statusMeta.setAttribute('name','apple-mobile-web-app-status-bar-style');document.head.appendChild(statusMeta)}statusMeta.setAttribute('content',resolved==='dark'?'black-translucent':'default')}catch(e){}})();`;
}

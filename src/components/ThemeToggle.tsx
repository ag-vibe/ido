import { useEffect, useState } from "react";
import { applyThemeMode, getInitialThemeMode, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

// Sun icon
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Moon icon
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Auto icon — half sun half moon
function AutoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* left half: moon */}
      <path
        d="M12 3a9 9 0 0 0 0 18V3z"
        fill="currentColor"
        opacity="0.35"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      {/* right-side sun rays */}
      <path
        d="M12 2v2M19.07 4.93l-1.41 1.41M22 12h-2M19.07 19.07l-1.41-1.41M12 20v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

const ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  auto: AutoIcon,
} as const;

const NEXT: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "auto",
  auto: "light",
};

const LABELS: Record<ThemeMode, string> = {
  light: "Light mode. Click for dark.",
  dark: "Dark mode. Click for auto.",
  auto: "Auto (system) mode. Click for light.",
};

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const initialMode = getInitialThemeMode();
    setMode(initialMode);
    applyThemeMode(initialMode);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("auto");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  function toggle() {
    const next = NEXT[mode];
    setMode(next);
    applyThemeMode(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  const Icon = ICONS[mode];

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={LABELS[mode]}
      title={LABELS[mode]}
      className="sd-capsule-btn"
    >
      <Icon />
    </button>
  );
}

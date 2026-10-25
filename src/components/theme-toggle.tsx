"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== "thirdmind:theme") return;
    document.documentElement.dataset.theme =
      event.newValue === "light" ? "light" : "dark";
    callback();
  };
  window.addEventListener("thirdmind:theme", callback);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener("thirdmind:theme", callback);
    window.removeEventListener("storage", sync);
  };
}
const snapshot = () =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dark");
  return (
    <button
      className="theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("thirdmind:theme", next);
        } catch {}
        window.dispatchEvent(new Event("thirdmind:theme"));
      }}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

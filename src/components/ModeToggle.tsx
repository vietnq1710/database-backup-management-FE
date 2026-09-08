import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--panel-mid)]/50"
      title={isDark ? "Chế độ sáng" : "Chế độ tối"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[var(--accent-yellow)]" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--accent-blue)]" />
      )}
    </button>
  );
}

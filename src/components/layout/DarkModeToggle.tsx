import {
    Moon, Sun
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";


export function DarkModeToggle() {
  const { userData, updateUserData } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("heading_theme");
    if (userData?.settings?.theme) {
      return userData.settings.theme === "dark";
    }
    return saved === "dark";
  });

  useEffect(() => {
    if (userData?.settings?.theme) {
      setIsDark(userData.settings.theme === "dark");
    }
  }, [userData?.settings?.theme]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("heading_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("heading_theme", "light");
    }
  }, [isDark]);

  const handleToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (userData) {
      updateUserData({ settings: { ...userData.settings, theme: nextDark ? "dark" : "light" } });
    }
  };

  return (
    <button 
      onClick={handleToggle}
      className="p-3 -m-1.5 text-muted hover:text-ink hover:bg-bg-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none"
      title="Toggle Night Mode"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

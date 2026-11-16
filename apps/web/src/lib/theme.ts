export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "meetings-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const storedTheme = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

export const resolveTheme = (preference: ThemePreference = storedTheme()) =>
  preference === "system" ? (matchMedia(DARK_QUERY).matches ? "dark" : "light") : preference;

const paint = (preference: ThemePreference) => {
  const dark = resolveTheme(preference) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
};

export const applyTheme = (preference: ThemePreference) => {
  paint(preference);
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    return;
  }
};

if (typeof window !== "undefined") {
  matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (storedTheme() === "system") paint("system");
  });
}

export const THEME_SCRIPT = `try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("light",!d)}catch(e){}`;

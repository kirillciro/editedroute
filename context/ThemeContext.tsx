import { createContext, useContext, useState, ReactNode } from "react";
import { useColorScheme } from "react-native";
import { Primary, White, Black } from "@/utils/colors";

type Theme = "light" | "dark" | "system";

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  colors: {
    bg: string;
    headerBg: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    isDark: boolean;
  };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>("dark");

  const isDark =
    theme === "system" ? systemScheme === "dark" : theme === "dark";

  const colors = isDark
    ? {
        bg: Black,
        headerBg: "#1c1c1e",
        card: "rgba(255, 255, 255, 0.08)",
        text: White,
        textSecondary: "rgba(255, 255, 255, 0.6)",
        border: "rgba(255, 255, 255, 0.2)",
        primary: Primary,
        isDark: true,
      }
    : {
        bg: White,
        headerBg: White,
        card: "rgba(0, 0, 0, 0.04)",
        text: Black,
        textSecondary: "rgba(0, 0, 0, 0.6)",
        border: "rgba(0, 0, 0, 0.25)",
        primary: Primary,
        isDark: false,
      };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

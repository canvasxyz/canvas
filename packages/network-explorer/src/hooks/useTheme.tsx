import { createContext, useContext, useEffect, useState } from 'react';

type ThemeAppearance = 'light' | 'dark';
type ThemeContextType = {
  theme: ThemeAppearance;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeAppearance>(() => {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') return 'light';

    // Check localStorage first
    const savedTheme = localStorage.getItem('theme') as ThemeAppearance | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

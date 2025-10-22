import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

import { lightTheme, darkTheme, Theme } from '@/theme/tokens';

type ThemeContextValue = {
  colorScheme: ColorSchemeName;
  theme: Theme;
  setColorScheme: (scheme: ColorSchemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>('light');

  const value = useMemo<ThemeContextValue>(() => {
    const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
    return {
      colorScheme,
      theme,
      setColorScheme,
    };
  }, [colorScheme]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const buttonStyle = colorScheme === 'dark' ? 'light' : 'dark';
      void NavigationBar.setButtonStyleAsync(buttonStyle);
    }
  }, [colorScheme, value.theme.colors.background]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

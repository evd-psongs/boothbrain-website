export type Theme = {
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    primary: string;
    primaryDark: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    overlay: string;
  };
  spacing: (value: number) => number;
  radii: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  typography: {
    display: TextStyle;
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    body: TextStyle;
    bodyBold: TextStyle;
    small: TextStyle;
    caption: TextStyle;
  };
  shadow: {
    card: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
};

type TextStyle = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight?: '400' | '500' | '600';
  letterSpacing?: number;
};

const spacingScale = (value: number) => value * 4;

const baseTypography = {
  fontFamily: 'System',
  letterSpacing: 0,
};

export const lightTheme: Theme = {
  colors: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceMuted: '#E6E8F0',
    primary: '#6558F5',
    primaryDark: '#5144D4',
    secondary: '#23B5D3',
    success: '#2DBA7F',
    warning: '#F7B500',
    error: '#F3696E',
    textPrimary: '#1A1B23',
    textSecondary: '#4B4D5F',
    textMuted: '#7A7D90',
    border: '#D5D7E2',
    overlay: 'rgba(9, 10, 15, 0.6)',
  },
  spacing: spacingScale,
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  typography: {
    display: { ...baseTypography, fontSize: 32, lineHeight: 40, fontWeight: '600' },
    h1: { ...baseTypography, fontSize: 26, lineHeight: 34, fontWeight: '600' },
    h2: { ...baseTypography, fontSize: 22, lineHeight: 30, fontWeight: '600' },
    h3: { ...baseTypography, fontSize: 18, lineHeight: 26, fontWeight: '500' },
    body: { ...baseTypography, fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyBold: { ...baseTypography, fontSize: 16, lineHeight: 24, fontWeight: '600' },
    small: { ...baseTypography, fontSize: 14, lineHeight: 20, fontWeight: '400' },
    caption: { ...baseTypography, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  },
  shadow: {
    card: {
      shadowColor: 'rgba(10, 13, 25, 0.18)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    background: '#090A0F',
    surface: '#11121A',
    surfaceMuted: '#151721',
    primary: '#7D6FFF',
    primaryDark: '#5F4CE2',
    secondary: '#25C7E6',
    success: '#38CE91',
    warning: '#FFC43D',
    error: '#FF6B81',
    textPrimary: '#F8F9FD',
    textSecondary: '#C7CADB',
    textMuted: '#8F92A6',
    border: '#242736',
    overlay: 'rgba(245, 246, 248, 0.6)',
  },
};

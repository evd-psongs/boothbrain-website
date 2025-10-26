import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BoothBrainNext',
  slug: 'boothbrain-next',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'boothbrain',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#090A0F',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.boothbrain.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F5F6F8',
    },
    package: 'com.boothbrain.app',
  },
  androidNavigationBar: {
    backgroundColor: '#F5F6F8',
    barStyle: 'dark-content',
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-document-picker',
    'expo-camera',
    'sentry-expo',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: 'https://boothbrain.app',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'production',
    eas: {
      projectId: '9e8924e1-5394-4cc3-86dc-499d23ebe789',
    },
  },
});

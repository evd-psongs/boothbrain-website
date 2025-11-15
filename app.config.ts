import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BoothBrain',
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
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription: 'BoothBrain uses Face ID to securely authenticate you when you return to the app.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F5F6F8',
    },
    package: 'com.boothbrain.app',
    googleServicesFile: './google-services.json',
    permissions: [
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
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
    'expo-local-authentication',
    [
      'expo-build-properties',
      {
        ios: {
          privacyManifestAggregationEnabled: false,
        },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
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
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'production',
    eas: {
      projectId: 'f0113217-0f08-470d-aa1b-3f8870ef9198',
    },
  },
});

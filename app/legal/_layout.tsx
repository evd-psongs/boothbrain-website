import { Stack } from 'expo-router';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontSize: 20, fontWeight: '600' },
      }}
    />
  );
}

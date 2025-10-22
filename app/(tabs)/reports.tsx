import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

export default function ReportsScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Reports Screen</Text>
      <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Build feature here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

type ImportSummaryCardProps = {
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
  onDismiss: () => void;
};

export function ImportSummaryCard({ summary, onDismiss }: ImportSummaryCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.summaryCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>Last import</Text>
        <Pressable onPress={onDismiss} hitSlop={12}>
          <Feather name="x" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.summaryRow}>
        <SummaryPill
          label="Added"
          value={summary.created}
          color={theme.colors.success}
          subtle="rgba(45, 186, 127, 0.12)"
        />
        <SummaryPill
          label="Updated"
          value={summary.updated}
          color={theme.colors.primary}
          subtle="rgba(101, 88, 245, 0.12)"
        />
        <SummaryPill
          label="Skipped"
          value={summary.skipped}
          color={theme.colors.warning}
          subtle="rgba(247, 181, 0, 0.12)"
        />
      </View>
    </View>
  );
}

function SummaryPill({
  label,
  value,
  color,
  subtle,
}: {
  label: string;
  value: number;
  color: string;
  subtle: string;
}) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: subtle }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
});
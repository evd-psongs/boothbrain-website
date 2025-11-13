import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@/providers/ThemeProvider';
import type { EventRecord, EventChecklistItem } from '@/types/events';
import { formatEventRange, getEventPhase } from '@/utils/dates';

interface EventCardProps {
  event: EventRecord;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: (event: EventRecord) => void;
  onRemove: (eventId: string) => void;
  onToggleChecklistItem: (eventId: string, itemId: string, done: boolean) => void;
  onAddTask: (eventId: string, phase: 'prep' | 'live' | 'post') => void;
  theme: Theme;
}

export function EventCard({
  event,
  expanded,
  onToggleExpanded,
  onEdit,
  onRemove,
  onToggleChecklistItem,
  onAddTask,
  theme,
}: EventCardProps) {
  const eventPhase = getEventPhase(event.startDateISO, event.endDateISO);
  const phaseLabel = eventPhase === 'prep' ? 'Preparation' : eventPhase === 'live' ? 'Live' : 'Wrap-up';
  const filteredChecklist = event.checklist.filter((item) => item.phase === eventPhase);
  const remainingCount = event.checklist.filter((item) => item.phase !== eventPhase).length;

  return (
    <View
      style={[
        styles.prepCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => [
          styles.prepHeader,
          {
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.prepTitle, { color: theme.colors.textPrimary }]}>{event.name}</Text>
          <Text style={{ color: theme.colors.textSecondary }}>
            {formatEventRange(event.startDateISO, event.endDateISO)}
          </Text>
        </View>
        <View style={styles.prepHeaderActions}>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textSecondary}
          />
          <Pressable onPress={() => onEdit(event)} hitSlop={10}>
            <Feather name="edit-2" size={16} color={theme.colors.primary} />
          </Pressable>
          <Pressable onPress={() => onRemove(event.id)} hitSlop={10}>
            <Feather name="trash-2" size={16} color={theme.colors.error} />
          </Pressable>
        </View>
      </Pressable>

      {expanded ? (
        <>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8 }}>{phaseLabel}</Text>
          {filteredChecklist.length ? (
            <View style={{ gap: 8 }}>
              {filteredChecklist.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  eventId={event.id}
                  onToggle={onToggleChecklistItem}
                  theme={theme}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: theme.colors.textSecondary }}>No tasks for this phase yet.</Text>
          )}
          {remainingCount ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {remainingCount} task{remainingCount === 1 ? '' : 's'} saved for other phases.
            </Text>
          ) : null}
          <Pressable
            onPress={() => onAddTask(event.id, eventPhase)}
            style={({ pressed }) => [
              styles.addTaskButton,
              {
                borderColor: theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="plus" size={14} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>Add task</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function ChecklistItem({
  item,
  eventId,
  onToggle,
  theme,
}: {
  item: EventChecklistItem;
  eventId: string;
  onToggle: (eventId: string, itemId: string, done: boolean) => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={() => onToggle(eventId, item.id, !item.done)}
      style={({ pressed }) => [
        styles.checklistRow,
        {
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.done ? theme.colors.primary : theme.colors.border,
            backgroundColor: item.done ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {item.done ? <Feather name="check" size={12} color={theme.colors.surface} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: item.done ? theme.colors.textMuted : theme.colors.textPrimary,
            textDecorationLine: item.done ? 'line-through' : 'none',
          }}
        >
          {item.title}
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
          Tap to mark as {item.done ? 'incomplete' : 'done'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prepCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  prepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  prepTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  prepHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
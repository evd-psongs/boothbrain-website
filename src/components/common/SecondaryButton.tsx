import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Secondary button component for alternative actions
 * @example
 * <SecondaryButton
 *   title="Cancel"
 *   onPress={handleCancel}
 *   backgroundColor={theme.colors.surface}
 *   borderColor={theme.colors.border}
 *   textColor={theme.colors.textPrimary}
 * />
 */
export function SecondaryButton({
  title,
  onPress,
  disabled,
  loading,
  backgroundColor,
  borderColor,
  textColor,
  style,
}: SecondaryButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 52,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
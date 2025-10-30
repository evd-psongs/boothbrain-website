import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor: string;
  textColor: string;
}

/**
 * Primary button component for main actions
 * @example
 * <PrimaryButton
 *   title="Save Changes"
 *   onPress={handleSave}
 *   backgroundColor={theme.colors.primary}
 *   textColor={theme.colors.surface}
 * />
 */
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  backgroundColor,
  textColor,
}: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
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
    minHeight: 52,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
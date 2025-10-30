import React from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions, TextInputProps } from 'react-native';

export interface InputFieldProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  placeholderColor: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
}

/**
 * Reusable input field component with label
 * @example
 * <InputField
 *   label="Email"
 *   value={email}
 *   onChange={setEmail}
 *   placeholder="Enter your email"
 *   placeholderColor={theme.colors.textMuted}
 *   borderColor={theme.colors.border}
 *   backgroundColor={theme.colors.background}
 *   textColor={theme.colors.textPrimary}
 *   keyboardType="email-address"
 * />
 */
export function InputField({
  label,
  value,
  onChange,
  placeholder,
  placeholderColor,
  borderColor,
  backgroundColor,
  textColor,
  keyboardType,
  secureTextEntry,
  textContentType,
  autoCapitalize,
}: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: placeholderColor }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        style={[styles.input, { borderColor, backgroundColor, color: textColor }]}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
});
import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ViewStyle,
  StyleProp,
} from 'react-native';

interface KeyboardDismissibleViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  useScrollView?: boolean;
  keyboardVerticalOffset?: number;
}

/**
 * A unified wrapper component for handling keyboard interactions across the app.
 *
 * Features:
 * - Tap anywhere to dismiss keyboard
 * - Automatically adjusts content when keyboard appears (iOS)
 * - Optional ScrollView for scrollable content
 * - Prevents accidental dismissal of taps on interactive elements
 *
 * @param useScrollView - Wrap children in ScrollView (default: true for modals)
 * @param keyboardVerticalOffset - Additional offset for KeyboardAvoidingView (useful for headers)
 */
export function KeyboardDismissibleView({
  children,
  style,
  contentContainerStyle,
  useScrollView = true,
  keyboardVerticalOffset = 0,
}: KeyboardDismissibleViewProps) {
  const content = useScrollView ? (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={true}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={useScrollView ? { flex: 1 } : style}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

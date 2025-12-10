import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';

export type FeedbackState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

interface FeedbackBannerProps {
  feedback: FeedbackState;
  successColor: string;
  errorColor: string;
  infoColor?: string;
  surfaceColor: string;
  textColor: string;
}

/**
 * Animated feedback banner for showing success/error messages
 * @example
 * const [feedback, setFeedback] = useState<FeedbackState>(null);
 *
 * // Show feedback
 * setFeedback({ type: 'success', message: 'Changes saved!' });
 *
 * // Clear after delay
 * setTimeout(() => setFeedback(null), 3000);
 *
 * <FeedbackBanner
 *   feedback={feedback}
 *   successColor={theme.colors.success}
 *   errorColor={theme.colors.error}
 * />
 */
export function FeedbackBanner({
  feedback,
  successColor,
  errorColor,
  infoColor,
  surfaceColor,
  textColor,
}: FeedbackBannerProps) {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (feedback && currentFeedback !== feedback) {
      setCurrentFeedback(feedback);
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(-16);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          mass: 0.8,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!feedback && currentFeedback) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentFeedback(null);
        translateY.setValue(-16);
      });
    }
  }, [feedback, currentFeedback, opacity, translateY]);

  if (!currentFeedback) return null;

  const accentColor =
    currentFeedback.type === 'success'
      ? successColor
      : currentFeedback.type === 'error'
        ? errorColor
        : (infoColor ?? errorColor);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.feedbackToast,
        {
          backgroundColor: surfaceColor,
          borderLeftColor: accentColor,
        },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.feedbackText, { color: textColor }]}>{currentFeedback.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feedbackToast: {
    position: 'absolute',
    top: '40%', // Center vertically (40% from top for better visibility)
    left: 20,
    right: 20,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 18,
    paddingHorizontal: 24,
    zIndex: 1000,
    // Add shadow for better visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8, // Android shadow
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
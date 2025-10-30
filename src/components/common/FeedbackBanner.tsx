import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';

export type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

interface FeedbackBannerProps {
  feedback: FeedbackState;
  successColor: string;
  errorColor: string;
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

  const isSuccess = currentFeedback.type === 'success';
  const palette = isSuccess ? successColor : errorColor;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.feedbackToast,
        { backgroundColor: palette, borderColor: palette },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.feedbackText}>{currentFeedback.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feedbackToast: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    zIndex: 1000,
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    color: '#fff',
  },
});
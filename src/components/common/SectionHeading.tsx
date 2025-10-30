import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SectionHeadingProps {
  title: string;
  subtitle: string;
  titleColor: string;
  subtitleColor: string;
}

/**
 * Section heading component for grouping related content
 * @example
 * <SectionHeading
 *   title="Account Settings"
 *   subtitle="Manage your profile and preferences"
 *   titleColor={theme.colors.textPrimary}
 *   subtitleColor={theme.colors.textSecondary}
 * />
 */
export function SectionHeading({
  title,
  subtitle,
  titleColor,
  subtitleColor
}: SectionHeadingProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 20,
  },
});
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { logCrashlyticsEvent, recordError, testCrash } from '@/lib/services/firebase';

/**
 * Test component for Firebase Crashlytics
 * IMPORTANT: Only use in development to test crash reporting
 */
export const CrashlyticsTest = () => {
  const handleTestLog = () => {
    logCrashlyticsEvent('Test log event from CrashlyticsTest component');
    Alert.alert('Success', 'Log event sent to Crashlytics');
  };

  const handleTestNonFatalError = () => {
    try {
      // Simulate an error
      throw new Error('Test non-fatal error for Crashlytics');
    } catch (error) {
      recordError(error as Error, {
        context: 'CrashlyticsTest',
        action: 'Test non-fatal error button pressed'
      });
      Alert.alert('Success', 'Non-fatal error sent to Crashlytics');
    }
  };

  const handleTestJSError = () => {
    // This will trigger the ErrorBoundary
    throw new Error('Test JavaScript error for ErrorBoundary and Crashlytics');
  };

  const handleTestCrash = () => {
    Alert.alert(
      'Crash Test',
      'This will crash the app to test Crashlytics. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: () => {
            logCrashlyticsEvent('User initiated test crash');
            setTimeout(() => testCrash(), 100);
          }
        }
      ]
    );
  };

  if (!__DEV__) {
    return null; // Don't render in production
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crashlytics Test (Dev Only)</Text>

      <TouchableOpacity style={styles.button} onPress={handleTestLog}>
        <Text style={styles.buttonText}>Test Log Event</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={handleTestNonFatalError}>
        <Text style={styles.buttonText}>Test Non-Fatal Error</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={handleTestJSError}>
        <Text style={styles.buttonText}>Test JS Error (Triggers ErrorBoundary)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleTestCrash}>
        <Text style={styles.buttonText}>Test Crash (Force Crash)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    margin: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#92400E',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  dangerButton: {
    backgroundColor: '#991B1B',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
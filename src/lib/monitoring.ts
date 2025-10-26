import { createElement, useEffect } from 'react';
import type { ComponentType } from 'react';
import Constants from 'expo-constants';

type SentryModule = typeof import('sentry-expo');

const extra = (Constants?.expoConfig?.extra ?? {}) as {
  sentryDsn?: string | null;
  environment?: string | null;
  eas?: { projectId?: string | null } | null;
};

const sentryDsn =
  typeof extra.sentryDsn === 'string' && extra.sentryDsn.trim().length > 0 ? extra.sentryDsn : null;
const environment = extra.environment ?? 'production';
const runtimeVersion = Constants.expoConfig?.runtimeVersion;
const release =
  Constants.expoConfig?.version ??
  (typeof runtimeVersion === 'string' ? runtimeVersion : undefined) ??
  extra.eas?.projectId ??
  undefined;

export const isSentryEnabled = Boolean(sentryDsn);

let sentryModulePromise: Promise<SentryModule> | null = null;
let initPromise: Promise<SentryModule | null> | null = null;
let sentryInitialized = false;

async function loadSentryModule(): Promise<SentryModule> {
  if (!sentryModulePromise) {
    sentryModulePromise = import('sentry-expo').catch((error) => {
      sentryModulePromise = null;
      throw error;
    });
  }
  return sentryModulePromise;
}

export async function ensureSentry(): Promise<SentryModule | null> {
  if (!isSentryEnabled) return null;
  if (!initPromise) {
    initPromise = loadSentryModule()
      .then((Sentry) => {
        if (!sentryInitialized) {
          try {
            Sentry.init({
              dsn: sentryDsn ?? undefined,
              enableInExpoDevelopment: true,
              debug: environment !== 'production',
              environment,
              release,
              tracesSampleRate: environment === 'production' ? 0.05 : 1.0,
              integrations: (defaultIntegrations) => {
                if (!Array.isArray(defaultIntegrations)) {
                  return defaultIntegrations;
                }

                const { Native } = Sentry;
                const ReactNativeErrorHandlers = Native?.Integrations?.ReactNativeErrorHandlers;
                if (!ReactNativeErrorHandlers) {
                  return defaultIntegrations;
                }

                return defaultIntegrations.map((integration) => {
                  if (
                    integration &&
                    typeof integration === 'object' &&
                    'name' in integration &&
                    (integration as { name?: string }).name === 'ReactNativeErrorHandlers'
                  ) {
                    return new ReactNativeErrorHandlers({
                      onerror: false,
                      onunhandledrejection: true,
                      patchGlobalPromise: false,
                    });
                  }

                  return integration;
                });
              },
            });
            sentryInitialized = true;
          } catch (initError) {
            console.warn('Sentry initialization failed', initError);
            return null;
          }
        }
        return Sentry;
      })
      .catch((error) => {
        console.warn('Sentry module failed to load', error);
        initPromise = null;
        return null;
      });
  }

  return initPromise;
}

export async function captureException(error: unknown) {
  const sentry = await ensureSentry();
  if (!sentry) {
    console.warn('Sentry disabled; not capturing exception', error);
    return;
  }

  const normalizedError = error instanceof Error ? error : new Error(String(error));
  try {
    if (typeof (sentry as any).captureException === 'function') {
      (sentry as any).captureException(normalizedError);
    } else if (sentry.Native?.captureException) {
      sentry.Native.captureException(normalizedError);
    } else {
      throw new Error('Sentry captureException unavailable');
    }
  } catch (captureError) {
    console.warn('Failed to send Sentry exception', captureError);
  }
}

export function withSentryWrap<T extends ComponentType<any>>(Component: T): T {
  if (!isSentryEnabled) return Component;

  function SentryWrapper(props: any) {
    useEffect(() => {
      void ensureSentry();
    }, []);

    return createElement(Component, props);
  }

  SentryWrapper.displayName = Component.displayName ?? Component.name ?? 'SentryWrapper';

  return SentryWrapper as unknown as T;
}

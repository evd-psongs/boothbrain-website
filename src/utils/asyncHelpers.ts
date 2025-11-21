/**
 * Async utility functions for handling promises with timeout, retry, and error handling
 */

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Error message when timeout occurs
 * @returns The resolved value of the promise
 * @throws Error if the promise times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Retries a function with exponential backoff
 * @param fn The async function to retry
 * @param maxRetries Maximum number of retry attempts (default: 2)
 * @param initialDelay Initial delay in milliseconds (default: 500)
 * @returns The resolved value of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelay = 500
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on timeout errors or if we're on the last attempt
      if (error.message?.includes('Timed out') || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Combines timeout and retry logic for an async operation
 * @param fn The async function to execute
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Error message when timeout occurs
 * @param maxRetries Maximum number of retry attempts
 * @returns The resolved value of the function
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out',
  maxRetries = 2
): Promise<T> {
  const wrappedFn = () => withTimeout(fn(), timeoutMs, timeoutMessage);
  return withRetry(wrappedFn, maxRetries);
}

/**
 * Creates a delay promise
 * @param ms Delay in milliseconds
 * @returns A promise that resolves after the specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs promises in parallel with a concurrency limit
 * @param items Array of items to process
 * @param fn Function to run for each item
 * @param concurrency Maximum number of concurrent operations
 * @returns Array of results in the same order as input
 */
export async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then((result) => {
      results[i] = result;
    });

    if (items.length <= concurrency) {
      executing.push(promise);
    } else {
      executing.push(promise);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === promise),
          1
        );
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Debounces an async function
 * @param fn The async function to debounce
 * @param delayMs Delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    return new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  };
}

/**
 * Platform and environment-aware timeout configuration
 */
export type TimeoutConfig = {
  session?: number;
  profile?: number;
  subscription?: number;
  default?: number;
};

const DEFAULT_TIMEOUTS: TimeoutConfig = {
  session: 10000, // Keep session timeout a bit longer
  profile: 5000,  // Fail fast for profile (5s) so user isn't waiting
  subscription: 5000,
  default: 10000,
};

const IOS_DEV_TIMEOUTS: TimeoutConfig = {
  session: 3000,
  profile: 5000,
  subscription: 5000,
  default: 5000,
};

/**
 * Gets appropriate timeout based on platform and environment
 * @param type Type of operation
 * @param platform Current platform ('ios', 'android', 'web')
 * @param isDevelopment Whether running in development mode
 * @returns Timeout in milliseconds
 */
export function getTimeout(
  type: keyof TimeoutConfig = 'default',
  platform = 'web',
  isDevelopment = false
): number {
  // Use shorter timeouts on iOS in development to prevent infinite loading
  if (platform === 'ios' && isDevelopment) {
    return IOS_DEV_TIMEOUTS[type] ?? IOS_DEV_TIMEOUTS.default ?? 5000;
  }
  return DEFAULT_TIMEOUTS[type] ?? DEFAULT_TIMEOUTS.default ?? 10000;
}
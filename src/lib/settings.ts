import { supabase } from '@/lib/supabase';

const SETTINGS_TABLE = 'settings';

const userPrefix = (userId: string) => `user:${userId}:`;

const buildStorageKey = (userId: string, key: string) => `${userPrefix(userId)}${key}`;

const stripStorageKey = (userId: string, storageKey: string) => {
  const prefix = userPrefix(userId);
  if (storageKey.startsWith(prefix)) {
    return storageKey.slice(prefix.length);
  }
  return storageKey;
};

export async function fetchUserSettings(
  userId: string,
  keys: string[],
): Promise<Record<string, string | null>> {
  if (!userId || keys.length === 0) {
    return {};
  }

  const storageKeys = keys.map((key) => buildStorageKey(userId, key));
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('key, value')
    .in('key', storageKeys);

  if (error) {
    throw error;
  }

  const result: Record<string, string | null> = {};

  keys.forEach((key) => {
    result[key] = null;
  });

  (data ?? []).forEach((row: { key: string; value: string | null }) => {
    const normalizedKey = stripStorageKey(userId, row.key);
    result[normalizedKey] = row.value ?? null;
  });

  return result;
}

export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  const storageKey = buildStorageKey(userId, key);
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert({
      key: storageKey,
      value,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export async function deleteUserSetting(userId: string, key: string): Promise<void> {
  const storageKey = buildStorageKey(userId, key);
  const { error } = await supabase.from(SETTINGS_TABLE).delete().eq('key', storageKey);

  if (error) {
    throw error;
  }
}

import { supabase } from '@/lib/supabase';

const SETTINGS_TABLE = 'user_settings';

export async function fetchUserSettings(
  userId: string,
  keys: string[],
): Promise<Record<string, string | null>> {
  if (!userId || keys.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('key, value')
    .eq('user_id', userId)
    .in('key', keys);

  if (error) {
    throw error;
  }

  const result: Record<string, string | null> = {};

  keys.forEach((key) => {
    result[key] = null;
  });

  (data ?? []).forEach((row: { key: string; value: string | null }) => {
    result[row.key] = row.value ?? null;
  });

  return result;
}

export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(
      {
        user_id: userId,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    );

  if (error) {
    throw error;
  }
}

export async function deleteUserSetting(userId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('key', key);

  if (error) {
    throw error;
  }
}

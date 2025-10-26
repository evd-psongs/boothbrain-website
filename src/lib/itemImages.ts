import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

const BUCKET = 'item-images';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

type UploadResult = {
  path: string;
  url: string;
};

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

const guessContentType = (uri: string) => {
  const extension = uri.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
};

export async function getItemImageUrl(path: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
  if (!path) {
    throw new Error('No item image path provided.');
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to create signed URL for item image.');
  }

  return data.signedUrl;
}

export async function uploadItemImage({
  userId,
  uri,
}: {
  userId: string;
  uri: string;
}): Promise<UploadResult> {
  const contentTypeFromUri = guessContentType(uri);

  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error('Unable to read local image file.');
  }

  const extensionMatch = uri.split('.').pop();
  const extension = extensionMatch ? extensionMatch.toLowerCase() : contentTypeFromUri.split('/')[1] ?? 'jpg';
  const filename = `${Date.now()}-${randomSuffix()}.${extension}`;
  const path = `${userId}/${filename}`;

  const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = Uint8Array.from(atob(fileData), (c) => c.charCodeAt(0));

  const { error } = await supabase.storage.from(BUCKET).upload(path, binary, {
    contentType: contentTypeFromUri,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const url = await getItemImageUrl(path);

  return {
    path,
    url,
  };
}

export async function removeItemImage(path: string) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}

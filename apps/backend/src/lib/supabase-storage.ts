import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class AvatarUploadError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

let client: SupabaseClient | null = null;

// Lazy init, not module-load-time — mirrors lib/fcm.ts's ensureInitialized:
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are blank in dev/test until the
// bucket is actually provisioned, and this module is imported transitively
// by auth.routes.ts, so eager init would throw for every test file that
// pulls auth in, long before any test exercises an upload.
function ensureClient(): SupabaseClient {
  if (client) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AvatarUploadError('Avatar upload is not configured', 503);
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return client;
}

/**
 * Uploads one avatar image to the configured Storage bucket at a path keyed
 * by user id, so a re-upload overwrites the previous file instead of
 * accumulating orphaned ones, and returns its public URL.
 */
export async function uploadAvatar(
  userId: string,
  contentType: string,
  data: Buffer,
): Promise<string> {
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    throw new AvatarUploadError('Avatar must be a JPEG, PNG, or WebP image', 400);
  }

  const supabase = ensureClient();
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(env.SUPABASE_AVATARS_BUCKET)
    .upload(path, data, { contentType, upsert: true });

  if (error) {
    throw new AvatarUploadError('Could not upload avatar', 502);
  }

  const { data: publicUrlData } = supabase.storage
    .from(env.SUPABASE_AVATARS_BUCKET)
    .getPublicUrl(path);

  // Cache-bust: the path is stable across re-uploads (that's the point —
  // no orphaned files), so without this every browser/client that already
  // cached the old image at this exact URL would keep showing it.
  return `${publicUrlData.publicUrl}?v=${Date.now()}`;
}

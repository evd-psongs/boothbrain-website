import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const authClient = createClient(supabaseUrl, serviceRoleKey);

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

export async function getAuthenticatedUser(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return null;

  const { data, error } = await authClient.auth.getUser(token);
  if (error) {
    console.warn('auth: failed to resolve user from token', error?.message ?? error);
    return null;
  }

  return data.user ?? null;
}

export async function requireUserMatch(req: Request, expectedUserId: string) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error: Error & { status?: number } = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
  if (user.id !== expectedUserId) {
    const error: Error & { status?: number } = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
  return user;
}

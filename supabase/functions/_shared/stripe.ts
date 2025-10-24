const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

if (!stripeSecret) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const encoder = new TextEncoder();

const formatParams = (params: Record<string, string | number | boolean | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  return search;
};

export async function stripeRequest(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  options?: { method?: 'POST' | 'DELETE'; },
) {
  const response = await fetch(`${STRIPE_API_BASE}/${path}`, {
    method: options?.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formatParams(params),
  });

  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message ?? JSON.stringify(body);
    throw new Error(message);
  }
  return body;
}

export async function stripeGet(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(`${STRIPE_API_BASE}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message ?? JSON.stringify(body);
    throw new Error(message);
  }
  return body;
}

export async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const elements = header.split(',').map((part) => part.split('='));
  const timestamp = elements.find(([key]) => key === 't')?.[1];
  const signatures = elements.filter(([key]) => key === 'v1').map(([, value]) => value);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const encodedPayload = encoder.encode(`${timestamp}.${payload}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encodedPayload);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const constantTimeCompare = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i += 1) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  };

  return signatures.some((candidate) => constantTimeCompare(candidate, signatureHex));
}

export async function createStripeCustomer(params: Record<string, string | number | boolean | null | undefined>) {
  return stripeRequest('customers', params);
}


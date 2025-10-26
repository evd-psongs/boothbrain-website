type DsnParts = {
  projectId: string;
  key: string;
  host: string;
  protocol: string;
};

const rawDsn = Deno.env.get('SENTRY_DSN') ?? null;
const environment = Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production';
const release = Deno.env.get('SENTRY_RELEASE') ?? undefined;
const tracesSampleRate = Number.parseFloat(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE') ?? '0');

let dsnParts: DsnParts | null = null;

function parseDsn(dsn: string): DsnParts | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!projectId) return null;
    const key = url.username;
    if (!key) return null;
    return {
      projectId,
      key,
      host: url.host,
      protocol: url.protocol.replace(':', ''),
    };
  } catch {
    return null;
  }
}

if (rawDsn) {
  dsnParts = parseDsn(rawDsn);
  if (!dsnParts) {
    console.warn('Sentry DSN is invalid; monitoring disabled.');
  }
}

async function sendSentryEvent(event: Record<string, unknown>): Promise<void> {
  if (!dsnParts) return;

  const { projectId, key, host, protocol } = dsnParts;
  const envelopeHeader = {
    event_id: event.event_id,
    dsn: rawDsn,
  };

  const itemHeader = {
    type: 'event',
    sample_rates: tracesSampleRate ? [{ id: 'trace', rate: tracesSampleRate }] : undefined,
  };

  const envelope = `${JSON.stringify(envelopeHeader)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}`;

  try {
    await fetch(`${protocol}://${host}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=boothbrain-edge/1.0, sentry_key=${key}`,
      },
      body: envelope,
      keepalive: true,
    });
  } catch (transportError) {
    console.warn('Sentry transport failed', transportError);
  }
}

function buildEvent(error: unknown, context: { req: Request; status?: number }): Record<string, unknown> {
  const eventId = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, '');
  const err = error instanceof Error ? error : new Error(String(error));

  const stacktrace = err.stack ? [{ type: err.constructor?.name ?? 'Error', value: err.stack }] : undefined;

  return {
    event_id: eventId,
    platform: 'javascript',
    level: 'error',
    timestamp: new Date().toISOString(),
    environment,
    release,
    message: err.message ?? 'Edge function error',
    exception: {
      values: [
        {
          type: err.constructor?.name ?? 'Error',
          value: err.message ?? String(err),
          stacktrace: stacktrace ? { frames: stacktrace } : undefined,
        },
      ],
    },
    request: {
      method: context.req.method,
      url: context.req.url,
      headers: Object.fromEntries(context.req.headers.entries()),
    },
    tags: {
      'edge.function': context.req.headers.get('x-supabase-function-name') ?? 'edge-function',
      'edge.region': context.req.headers.get('x-forwarded-region') ?? 'unknown',
    },
    extra: {
      status: context.status ?? 500,
    },
  };
}

export async function withMonitoring<T>(context: { req: Request; handler: () => Promise<T> }): Promise<T> {
  if (!dsnParts) {
    return context.handler();
  }

  try {
    const result = await context.handler();
    return result;
  } catch (error) {
    await sendSentryEvent(buildEvent(error, { req: context.req }));
    throw error;
  }
}

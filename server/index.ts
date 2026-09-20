import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type {
  AutomationInterpretRequest,
  AutomationInterpretResponse,
} from '../src/types/automation';
import { getAllowedOrigins, getHost, getModel, getPort, isDevelopment, isTypeSafeConfigured } from './config';
import { buildHealthResponse, interpretPrompt } from './automation';

function isOriginAllowed(origin: string | undefined, requestHost: string | undefined): boolean {
  if (!origin) return true;

  try {
    if (requestHost && new URL(origin).host === requestHost) {
      return true;
    }
  } catch {
    return false;
  }

  return getAllowedOrigins().includes(origin);
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  origin: string | undefined,
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  res.writeHead(statusCode, headers);
  res.end(statusCode === 204 ? undefined : JSON.stringify(body));
}

function buildClientMessage(error: unknown): string {
  if (isDevelopment() && error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Automation request failed.';
}

function logServerError(requestId: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[automation][${requestId}] ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return;
  }

  console.error(`[automation][${requestId}]`, error);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const requestHost = typeof req.headers.host === 'string' ? req.headers.host : undefined;
  const allowedOrigin = isOriginAllowed(origin, requestHost) ? origin : undefined;
  const url = new URL(req.url ?? '/', `http://${requestHost ?? 'localhost'}`);

  if (origin && !allowedOrigin) {
    sendJson(res, 403, { ok: false, message: 'Origin not allowed.' }, undefined);
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null, allowedOrigin);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/automation/health') {
    sendJson(res, 200, buildHealthResponse(), allowedOrigin);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/automation/interpret') {
    try {
      const body = await readJson<AutomationInterpretRequest>(req);
      const prompt = body.prompt?.trim();

      if (!prompt) {
        const response: AutomationInterpretResponse = {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Expected a non-empty `prompt` string.',
          requestId: isDevelopment() ? undefined : requestId,
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        };
        sendJson(res, 400, response, allowedOrigin);
        return;
      }

      if (!body.workspace || !Number.isInteger(body.workspace.basePrefix)) {
        const response: AutomationInterpretResponse = {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Expected workspace context with a valid `basePrefix`.',
          requestId: isDevelopment() ? undefined : requestId,
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        };
        sendJson(res, 400, response, allowedOrigin);
        return;
      }

      const response = await interpretPrompt(body);
      const statusCode = response.status === 'not-configured'
        ? 503
        : response.status === 'error'
          ? 502
          : 200;
      sendJson(res, statusCode, {
        ...response,
        ...(response.status === 'error' && !isDevelopment() ? { message: 'Automation provider error.' } : {}),
        ...(isDevelopment() ? {} : { requestId }),
      }, allowedOrigin);
      return;
    } catch (error) {
      logServerError(requestId, error);
      const response: AutomationInterpretResponse = {
        ok: false,
        provider: 'typesafe',
        configured: isTypeSafeConfigured(),
        status: 'error',
        message: buildClientMessage(error),
        requestId: isDevelopment() ? undefined : requestId,
        supportedIntents: buildHealthResponse().supportedIntents,
        plan: null,
      };
      sendJson(res, 502, response, allowedOrigin);
      return;
    }
  }

  sendJson(res, 404, {
    ok: false,
    message: 'Not found',
  }, allowedOrigin);
});

const port = getPort();
const host = getHost();
server.listen(port, host, () => {
  console.log(`[automation] listening on http://${host}:${port}`);
  console.log(`[automation] allowed origins: ${getAllowedOrigins().join(', ')}`);
  console.log(`[automation] provider=typesafe configured=${isTypeSafeConfigured()} model=${getModel()}`);
});

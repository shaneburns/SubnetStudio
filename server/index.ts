import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type {
  AutomationInterpretResponse,
  AutomationWorkspaceContext,
} from '../src/types/automation';
import { getAllowedOrigins, getHost, getModel, getPort, isDevelopment, isTypeSafeConfigured } from './config';
import { buildHealthResponse, interpretPrompt } from './automation';

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

class RequestBodyTooLargeError extends Error {}
class InvalidJsonRequestError extends Error {}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidWorkspace(value: unknown): value is AutomationWorkspaceContext {
  if (!isRecord(value)) return false;
  const { baseCidr, basePrefix, mode, equalSplitPrefix } = value;
  if (typeof baseCidr !== 'string') return false;

  const match = baseCidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  const cidrPrefix = Number(match[5]);
  if (octets.some(octet => octet < 0 || octet > 255)) return false;
  if (!Number.isInteger(basePrefix) || basePrefix !== cidrPrefix || basePrefix < 0 || basePrefix > 32) return false;
  const address = octets.reduce((value, octet) => (value << 8) | octet, 0) >>> 0;
  const mask = basePrefix === 0 ? 0 : (0xffffffff << (32 - basePrefix)) >>> 0;
  if (((address & mask) >>> 0) !== address) return false;
  if (mode !== 'equal-split' && mode !== 'vlsm') return false;
  if (equalSplitPrefix !== null) {
    if (typeof equalSplitPrefix !== 'number'
      || !Number.isInteger(equalSplitPrefix)
      || equalSplitPrefix <= basePrefix
      || equalSplitPrefix > 32) return false;
    if (Math.pow(2, equalSplitPrefix - basePrefix) > 4096) return false;
  }
  return true;
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    req.resume();
    throw new RequestBodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BODY_BYTES) {
      tooLarge = true;
    } else if (!tooLarge) {
      chunks.push(buffer);
    }
  }

  if (tooLarge) throw new RequestBodyTooLargeError();
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) throw new InvalidJsonRequestError();
    throw error;
  }
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const requestHost = typeof req.headers.host === 'string' ? req.headers.host : undefined;
  const allowedOrigin = isOriginAllowed(origin) ? origin : undefined;
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
      const body = await readJson<unknown>(req);
      const prompt = isRecord(body) && typeof body.prompt === 'string' ? body.prompt.trim() : '';

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

      if (!isRecord(body) || !isValidWorkspace(body.workspace)) {
        const response: AutomationInterpretResponse = {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Expected workspace context with a valid IPv4 CIDR, mode, and equal-split prefix.',
          requestId: isDevelopment() ? undefined : requestId,
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        };
        sendJson(res, 400, response, allowedOrigin);
        return;
      }

      const response = await interpretPrompt({ prompt, workspace: body.workspace });
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
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(res, 413, {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Request body exceeds the maximum allowed size.',
          requestId: isDevelopment() ? undefined : requestId,
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        } satisfies AutomationInterpretResponse, allowedOrigin);
        return;
      }
      if (error instanceof InvalidJsonRequestError) {
        sendJson(res, 400, {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Expected a valid JSON request body.',
          requestId: isDevelopment() ? undefined : requestId,
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        } satisfies AutomationInterpretResponse, allowedOrigin);
        return;
      }
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

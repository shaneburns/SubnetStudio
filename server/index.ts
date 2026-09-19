import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type {
  AutomationInterpretRequest,
  AutomationInterpretResponse,
} from '../src/types/automation';
import { getModel, getPort, isTypeSafeConfigured } from './config';
import { buildHealthResponse, interpretPrompt } from './automation';

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
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
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/automation/health') {
    sendJson(res, 200, buildHealthResponse());
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
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        };
        sendJson(res, 400, response);
        return;
      }

      if (!body.workspace || !Number.isInteger(body.workspace.basePrefix)) {
        const response: AutomationInterpretResponse = {
          ok: false,
          provider: 'typesafe',
          configured: isTypeSafeConfigured(),
          status: 'invalid-request',
          message: 'Expected workspace context with a valid `basePrefix`.',
          supportedIntents: buildHealthResponse().supportedIntents,
          plan: null,
        };
        sendJson(res, 400, response);
        return;
      }

      const response = await interpretPrompt(body);
      const statusCode = response.status === 'not-configured'
        ? 503
        : response.status === 'error'
          ? 502
          : 200;
      sendJson(res, statusCode, response);
      return;
    } catch (error) {
      const response: AutomationInterpretResponse = {
        ok: false,
        provider: 'typesafe',
        configured: isTypeSafeConfigured(),
        status: 'error',
        message: error instanceof Error ? error.message : 'Automation backend error.',
        supportedIntents: buildHealthResponse().supportedIntents,
        plan: null,
      };
      sendJson(res, 502, response);
      return;
    }
  }

  sendJson(res, 404, {
    ok: false,
    message: 'Not found',
  });
});

const port = getPort();
server.listen(port, () => {
  console.log(`[automation] listening on http://localhost:${port}`);
  console.log(`[automation] provider=typesafe configured=${isTypeSafeConfigured()} model=${getModel()}`);
});

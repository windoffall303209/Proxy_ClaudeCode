import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import {
  ProxyError,
  anthropicRequestToOpenAi,
  createMessageId,
  estimateAnthropicInputTokens,
  invalidRequest,
  mapStatusToAnthropicErrorType,
  openAiResponseToAnthropic
} from './anthropic.js';
import { buildUrl, loadConfig } from './config.js';
import { pipeOpenAiStreamAsAnthropic } from './stream.js';

function printHelp() {
  console.log(`Claude Code -> NVIDIA NIM proxy

Required environment variables:
  NIM_BASE_URL      OpenAI-compatible NVIDIA NIM v1 base URL
  NIM_MODEL         Actual upstream model name for NIM

Optional environment variables:
  HOST              Bind host (default: 127.0.0.1)
  PORT              Bind port (default: 8080)
  CLAUDE_PROXY_MODEL  Model name exposed back to Claude Code
  PROXY_API_KEY     Expected x-api-key from Claude Code
  NIM_API_KEY       Bearer token for NVIDIA hosted NIM
  REQUEST_TIMEOUT_MS  Upstream request timeout in milliseconds

Usage:
  npm start
  node src/server.js --help
`);
}

function createRequestId() {
  return `req_${randomUUID().replace(/-/gu, '')}`;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw invalidRequest('Request body must be valid JSON.');
  }
}

function getRequestApiKey(request) {
  const xApiKey = request.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return xApiKey.trim();
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return '';
}

function ensureProxyAuth(request, config) {
  if (!config.proxyApiKey) {
    return;
  }

  const apiKey = getRequestApiKey(request);
  if (apiKey !== config.proxyApiKey) {
    throw new ProxyError(401, 'authentication_error', 'Invalid proxy API key.');
  }
}

function sendJson(response, statusCode, payload, requestId) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'request-id': requestId
  });
  response.end(JSON.stringify(payload));
}

function sendAnthropicError(response, error, requestId) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const type = error?.type || mapStatusToAnthropicErrorType(status);
  const message = error?.message || 'Unexpected proxy error.';

  sendJson(
    response,
    status,
    {
      type: 'error',
      error: {
        type,
        message
      }
    },
    requestId
  );
}

async function readUpstreamError(response) {
  const rawText = await response.text();

  if (!rawText) {
    return new ProxyError(
      response.status,
      mapStatusToAnthropicErrorType(response.status),
      `NIM upstream returned HTTP ${response.status}.`
    );
  }

  try {
    const payload = JSON.parse(rawText);
    const message =
      payload?.error?.message ||
      payload?.message ||
      rawText;

    return new ProxyError(
      response.status,
      mapStatusToAnthropicErrorType(response.status),
      `NIM upstream error: ${message}`
    );
  } catch {
    return new ProxyError(
      response.status,
      mapStatusToAnthropicErrorType(response.status),
      `NIM upstream error: ${rawText}`
    );
  }
}

async function callNim(config, payload, signal) {
  const headers = {
    'content-type': 'application/json',
    accept: payload.stream ? 'text/event-stream' : 'application/json'
  };

  if (config.nimApiKey) {
    headers.authorization = `Bearer ${config.nimApiKey}`;
  }

  return fetch(buildUrl(config.nimBaseUrl, 'chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });
}

function createAbortController(response, timeoutMs) {
  const controller = new AbortController();

  const timeoutHandle = setTimeout(() => {
    controller.abort(new ProxyError(504, 'api_error', 'Upstream NIM request timed out.'));
  }, timeoutMs);

  response.on('close', () => {
    controller.abort(new ProxyError(499, 'api_error', 'Client closed the request.'));
  });

  return {
    controller,
    dispose() {
      clearTimeout(timeoutHandle);
    }
  };
}

function normalizePath(url) {
  const parsed = new URL(url, 'http://localhost');
  const trimmed = parsed.pathname.replace(/\/+$/u, '') || '/';
  return trimmed;
}

function modelPayload(config) {
  return {
    type: 'model',
    id: config.claudeProxyModel,
    display_name: `${config.claudeProxyModel} (proxy -> ${config.nimModel})`,
    created_at: '2026-03-16T00:00:00Z'
  };
}

async function handleMessages(request, response, config, requestId) {
  ensureProxyAuth(request, config);

  const body = await readJsonBody(request);
  const openAiRequest = anthropicRequestToOpenAi(body, config);
  const estimatedInputTokens = estimateAnthropicInputTokens(body);
  const facadeModel = body.model || config.claudeProxyModel;
  const messageId = createMessageId();

  const { controller, dispose } = createAbortController(response, config.requestTimeoutMs);

  try {
    const upstreamResponse = await callNim(config, openAiRequest, controller.signal);
    if (!upstreamResponse.ok) {
      throw await readUpstreamError(upstreamResponse);
    }

    if (body.stream) {
      await pipeOpenAiStreamAsAnthropic(upstreamResponse, response, {
        facadeModel,
        estimatedInputTokens,
        messageId,
        requestId
      });
      return;
    }

    const payload = await upstreamResponse.json();
    sendJson(
      response,
      200,
      openAiResponseToAnthropic(payload, {
        facadeModel,
        estimatedInputTokens,
        messageId
      }),
      requestId
    );
  } finally {
    dispose();
  }
}

async function handleTokenCount(request, response, config, requestId) {
  ensureProxyAuth(request, config);

  const body = await readJsonBody(request);
  sendJson(
    response,
    200,
    {
      input_tokens: estimateAnthropicInputTokens(body)
    },
    requestId
  );
}

async function routeRequest(request, response, config) {
  const requestId = createRequestId();
  const path = normalizePath(request.url || '/');

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-api-key,authorization,anthropic-version,anthropic-beta'
    });
    response.end();
    return;
  }

  try {
    if (request.method === 'GET' && path === '/') {
      sendJson(
        response,
        200,
        {
          ok: true,
          service: 'claudecode-nim-proxy',
          model: config.claudeProxyModel,
          upstream_model: config.nimModel
        },
        requestId
      );
      return;
    }

    if (request.method === 'GET' && path === '/healthz') {
      sendJson(
        response,
        200,
        {
          ok: true
        },
        requestId
      );
      return;
    }

    if (request.method === 'GET' && path === '/v1/models') {
      const model = modelPayload(config);
      sendJson(
        response,
        200,
        {
          data: [model],
          first_id: model.id,
          last_id: model.id,
          has_more: false
        },
        requestId
      );
      return;
    }

    if (request.method === 'GET' && path === `/v1/models/${config.claudeProxyModel}`) {
      sendJson(response, 200, modelPayload(config), requestId);
      return;
    }

    if (request.method === 'POST' && path === '/v1/messages') {
      await handleMessages(request, response, config, requestId);
      return;
    }

    if (request.method === 'POST' && path === '/v1/messages/count_tokens') {
      await handleTokenCount(request, response, config, requestId);
      return;
    }

    throw new ProxyError(404, 'not_found_error', `Route not found: ${request.method} ${path}`);
  } catch (error) {
    if (!response.headersSent) {
      sendAnthropicError(response, error, requestId);
      return;
    }

    response.end();
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const server = createServer((request, response) => {
    routeRequest(request, response, config).catch((error) => {
      if (!response.headersSent) {
        sendAnthropicError(response, error, createRequestId());
        return;
      }

      response.end();
    });
  });

  server.listen(config.port, config.host, () => {
    console.log(
      `Claude Code proxy listening on http://${config.host}:${config.port} -> ${config.nimBaseUrl} (model: ${config.nimModel})`
    );
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});


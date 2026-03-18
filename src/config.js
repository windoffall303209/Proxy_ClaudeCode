import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }

  return value;
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

export function buildUrl(baseUrl, pathName) {
  return new URL(pathName.replace(/^\/+/, ''), ensureTrailingSlash(baseUrl)).toString();
}

export function loadConfig(cwd = process.cwd()) {
  loadEnvFile(path.join(cwd, '.env'));

  return {
    host: process.env.HOST || '127.0.0.1',
    port: parseInteger('PORT', 8080),
    requestTimeoutMs: parseInteger('REQUEST_TIMEOUT_MS', 600000),
    claudeProxyModel: process.env.CLAUDE_PROXY_MODEL || 'claude-sonnet-4-5',
    proxyApiKey: process.env.PROXY_API_KEY || '',
    nimBaseUrl: requireEnv('NIM_BASE_URL'),
    nimApiKey: process.env.NIM_API_KEY || '',
    nimModel: requireEnv('NIM_MODEL')
  };
}

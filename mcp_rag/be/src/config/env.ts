import fs from 'fs';
import path from 'path';

type RawEnv = Record<string, string>;

function parseEnvFile(filePath: string): RawEnv {
  const raw = fs.readFileSync(filePath, 'utf-8');

  return raw
    .split('\n')
    .reduce<RawEnv>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return acc;

      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function required(env: RawEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(env: RawEnv, key: string): string | undefined {
  return env[key];
}

// Resolve relative to this file (be/src/config/) → be/.env
// This is cwd-independent: works regardless of where npm starts the process.
const envPath = path.resolve(__dirname, '../../.env');
const rawEnv = parseEnvFile(envPath);

export const rawEnvJson: RawEnv = rawEnv;

const config = {
  openai: {
    apiKey: required(rawEnv, 'OPENAI_API_KEY'),
    llmModel: required(rawEnv, 'LLM_MODEL'),
    embeddingModel: required(rawEnv, 'EMBEDDING_MODEL'),
  },
  db: {
    postgresUrl: required(rawEnv, 'POSTGRES_URL'),
  },
  chunk: {
    size: parseInt(required(rawEnv, 'CHUNK_SIZE'), 10),
    overlap: parseInt(required(rawEnv, 'CHUNK_OVERLAP'), 10),
  },
  rag: {
    minSimilarity: parseFloat(optional(rawEnv, 'MIN_SIMILARITY') ?? '0.3'),
  },
  server: {
    port: parseInt(required(rawEnv, 'PORT'), 10),
    nodeEnv: optional(rawEnv, 'NODE_ENV'),
  },
} as const;

export type Config = typeof config;
export default config;

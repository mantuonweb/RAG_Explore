import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { duckduckgoSearch, formatHits } from './tools/web-search';
import { fetchUrlContent } from './tools/fetch-url';
import { linkedinSearch, linkedinFetch } from './tools/linkedin';

const PORT = parseInt(process.env['MCP_PORT'] ?? '3001', 10);

// ── Server factory (one per HTTP request in stateless mode) ─────────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'rag-internet-tools',
    version: '1.0.0',
  });

  // ── Tool: web_search ────────────────────────────────────────────────────
  server.registerTool(
    'web_search',
    {
      description: 'Search the internet using DuckDuckGo. Returns titles, URLs, and snippets.',
      inputSchema: {
        query:       z.string().describe('Search query'),
        max_results: z.number().int().min(1).max(20).default(5).describe('Max results (default 5)'),
      },
    },
    async ({ query, max_results }) => {
      const hits = await duckduckgoSearch(query, max_results);
      return { content: [{ type: 'text' as const, text: formatHits(hits) }] };
    },
  );

  // ── Tool: fetch_url ─────────────────────────────────────────────────────
  server.registerTool(
    'fetch_url',
    {
      description: 'Fetch the text content of any public web page. Strips nav/scripts/styles and returns main text.',
      inputSchema: { url: z.string().url().describe('URL to fetch') },
    },
    async ({ url }) => {
      const { title, text } = await fetchUrlContent(url);
      return { content: [{ type: 'text' as const, text: `Title: ${title}\n\n${text}` }] };
    },
  );

  // ── Tool: linkedin_search ────────────────────────────────────────────────
  server.registerTool(
    'linkedin_search',
    {
      description: 'Search for a person\'s public LinkedIn profile URL using web search.',
      inputSchema: {
        name:    z.string().describe('Full name of the person'),
        company: z.string().optional().describe('Company name to narrow the search'),
      },
    },
    async ({ name, company }) => {
      const text = await linkedinSearch(name, company);
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // ── Tool: linkedin_fetch ─────────────────────────────────────────────────
  server.registerTool(
    'linkedin_fetch',
    {
      description: 'Attempt to fetch publicly visible text from a LinkedIn profile URL. Note: full profiles require login.',
      inputSchema: { profile_url: z.string().url().describe('LinkedIn profile URL (e.g. https://linkedin.com/in/someone)') },
    },
    async ({ profile_url }) => {
      const text = await linkedinFetch(profile_url);
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  return server;
}

// ── HTTP server (Streamable HTTP transport) ──────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Stateless mode: one transport + server per request
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  const server = buildMcpServer();
  await server.connect(transport);

  try {
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close();
  }
});

// GET /mcp — list available tools (convenience for inspection)
app.get('/mcp/tools', async (_req, res) => {
  res.json({
    tools: [
      { name: 'web_search',       description: 'Search the internet via DuckDuckGo' },
      { name: 'fetch_url',        description: 'Fetch text content of any web page' },
      { name: 'linkedin_search',  description: 'Find a LinkedIn profile URL by name' },
      { name: 'linkedin_fetch',   description: 'Fetch text from a LinkedIn profile URL' },
    ],
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'rag-mcp' }));

app.listen(PORT, () => {
  const sessionId = randomUUID().slice(0, 8);
  console.log(`[MCP] Server running on http://localhost:${PORT}/mcp  (session-prefix: ${sessionId})`);
  console.log('[MCP] Tools: web_search · fetch_url · linkedin_search · linkedin_fetch');
});

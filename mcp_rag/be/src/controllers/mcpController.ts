import { Request, Response } from 'express';
import { callMcpTool } from '../lib/mcp-client';

export async function mcpWebSearch(req: Request, res: Response): Promise<void> {
  const { query, max_results = 5 } = req.body as { query?: string; max_results?: number };

  if (!query?.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  try {
    const result = await callMcpTool('web_search', { query, max_results: Number(max_results) });
    if (!result) {
      res.status(503).json({ error: 'MCP server unavailable or returned no results' });
      return;
    }
    res.json({ results: result });
  } catch (err: unknown) {
    console.error('[mcp:web_search error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Web search failed', detail: message });
  }
}

export async function mcpLinkedinSearch(req: Request, res: Response): Promise<void> {
  const { name, company } = req.body as { name?: string; company?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    const result = await callMcpTool('linkedin_search', {
      name,
      ...(company ? { company } : {}),
    });
    if (!result) {
      res.status(503).json({ error: 'MCP server unavailable or returned no results' });
      return;
    }
    res.json({ results: result });
  } catch (err: unknown) {
    console.error('[mcp:linkedin_search error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'LinkedIn search failed', detail: message });
  }
}

export async function mcpFetchUrl(req: Request, res: Response): Promise<void> {
  const { url } = req.body as { url?: string };

  if (!url?.trim()) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    const result = await callMcpTool('fetch_url', { url });
    if (!result) {
      res.status(503).json({ error: 'MCP server unavailable or failed to fetch URL' });
      return;
    }
    res.json({ content: result });
  } catch (err: unknown) {
    console.error('[mcp:fetch_url error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'URL fetch failed', detail: message });
  }
}

import config from '../config/env';

interface McpTextContent {
  type: 'text';
  text: string;
}

interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

interface JsonRpcResponse {
  result?: McpToolResult;
  error?: { message: string };
}

const MCP_URL = process.env['MCP_URL'] ?? `http://localhost:${config.server.port + 1}/mcp`;

let _requestId = 0;

export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  try {
    const resp = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // StreamableHTTPServerTransport requires both accept types
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        id: ++_requestId,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      console.warn(`[mcp-client] ${toolName} → HTTP ${resp.status}`);
      return null;
    }

    const body = await resp.text();
    const json = parseJsonRpc(body);
    if (!json || json.error || !json.result) return null;

    return json.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
  } catch (err) {
    console.warn('[mcp-client] call failed:', err);
    return null;
  }
}

// StreamableHTTP may respond as plain JSON or as SSE (data: {...} lines)
function parseJsonRpc(body: string): JsonRpcResponse | null {
  try {
    // Plain JSON response
    return JSON.parse(body) as JsonRpcResponse;
  } catch {
    // SSE response — extract the first `data:` line that is a JSON-RPC reply
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      try {
        return JSON.parse(payload) as JsonRpcResponse;
      } catch {
        // not a JSON line, keep scanning
      }
    }
    return null;
  }
}

export async function webSearch(query: string, maxResults = 5): Promise<string | null> {
  return callMcpTool('web_search', { query, max_results: maxResults });
}

export async function linkedinSearch(name: string, company?: string): Promise<string | null> {
  return callMcpTool('linkedin_search', { name, ...(company ? { company } : {}) });
}

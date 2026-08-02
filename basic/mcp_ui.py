"""
MCP Explorer UI — a tiny web app that wraps the MCP client session
and lets you interact with the server through a browser.

Architecture:
  Browser  →  FastAPI (this file, port 8080)
                  │  MCP stdio
                  ▼
           mcp_server.py  →  FastAPI RAG backend (port 8000)
"""

import asyncio
import json
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.shared.exceptions import McpError

# ── MCP session (kept alive for the whole server lifetime) ────────────────────

_session: ClientSession | None = None
_read = _write = None
_stdio_ctx = _session_ctx = None

SERVER_PARAMS = StdioServerParameters(
    command="python3",
    args=["mcp_server.py"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _session, _read, _write, _stdio_ctx, _session_ctx

    # Open the stdio transport and session once at startup
    _stdio_ctx = stdio_client(SERVER_PARAMS)
    _read, _write = await _stdio_ctx.__aenter__()

    _session_ctx = ClientSession(_read, _write)
    _session = await _session_ctx.__aenter__()
    await _session.initialize()

    yield  # server is running

    # Clean up on shutdown
    await _session_ctx.__aexit__(None, None, None)
    await _stdio_ctx.__aexit__(None, None, None)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/tools")
async def list_tools():
    resp = await _session.list_tools()
    return [
        {
            "name": t.name,
            "description": t.description.strip(),
            "params": list(t.inputSchema.get("properties", {}).keys()),
            "required": t.inputSchema.get("required", []),
            "schema": t.inputSchema,
        }
        for t in resp.tools
    ]


@app.get("/api/resources")
async def list_resources():
    resp = await _session.list_resources()
    return [{"uri": str(r.uri), "description": (r.description or "").strip()} for r in resp.resources]


@app.get("/api/prompts")
async def list_prompts():
    resp = await _session.list_prompts()
    return [
        {
            "name": p.name,
            "description": (p.description or "").strip(),
            "args": [{"name": a.name, "required": a.required} for a in (p.arguments or [])],
        }
        for p in resp.prompts
    ]


@app.post("/api/call-tool")
async def call_tool(body: dict):
    name = body.get("name")
    arguments = body.get("arguments", {})
    try:
        result = await _session.call_tool(name, arguments=arguments)
    except McpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    contents = []
    for c in result.content:
        if hasattr(c, "text"):
            try:
                contents.append(json.loads(c.text))
            except Exception:
                contents.append(c.text)
    return {"isError": result.isError, "content": contents}


@app.get("/api/read-resource")
async def read_resource(uri: str):
    try:
        result = await _session.read_resource(uri)
    except McpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"contents": [{"uri": str(c.uri), "text": c.text} for c in result.contents]}


@app.get("/api/get-prompt")
async def get_prompt(name: str, args: str = "{}"):
    arguments = json.loads(args)
    try:
        result = await _session.get_prompt(name, arguments=arguments)
    except McpError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"messages": [{"role": m.role, "text": m.content.text} for m in result.messages]}


# ── UI ────────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def ui():
    return HTML


HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MCP Explorer</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2e3147;
    --accent: #7c6af7; --accent2: #4fc3f7; --text: #e2e8f0;
    --muted: #8892a4; --green: #4ade80; --red: #f87171;
    --yellow: #fbbf24;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif;
         min-height: 100vh; display: flex; flex-direction: column; }
  header { background: var(--surface); border-bottom: 1px solid var(--border);
           padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 1.1rem; font-weight: 600; letter-spacing: .03em; }
  .pill { font-size: .7rem; padding: 2px 10px; border-radius: 99px; font-weight: 600; }
  .pill.ok  { background: #16a34a33; color: var(--green); border: 1px solid #16a34a55; }
  .pill.err { background: #dc262633; color: var(--red);   border: 1px solid #dc262655; }
  main { display: grid; grid-template-columns: 260px 1fr; flex: 1; }
  nav { background: var(--surface); border-right: 1px solid var(--border);
        padding: 16px 0; overflow-y: auto; }
  nav h2 { font-size: .65rem; font-weight: 700; letter-spacing: .12em; color: var(--muted);
            padding: 0 16px; margin: 16px 0 6px; text-transform: uppercase; }
  nav h2:first-child { margin-top: 0; }
  .nav-item { display: block; padding: 7px 16px; cursor: pointer; font-size: .85rem;
               color: var(--muted); border-left: 2px solid transparent; transition: all .15s; }
  .nav-item:hover { color: var(--text); background: #ffffff08; }
  .nav-item.active { color: var(--text); border-left-color: var(--accent); background: #7c6af710; }
  .nav-item .tag { float: right; font-size: .65rem; color: var(--muted); }
  .content { padding: 24px; overflow-y: auto; }
  .panel { display: none; }
  .panel.active { display: block; }
  h3 { font-size: 1rem; font-weight: 600; margin-bottom: 16px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
           padding: 16px; margin-bottom: 12px; }
  .card-title { font-size: .9rem; font-weight: 600; color: var(--accent); margin-bottom: 6px; }
  .card-desc { font-size: .8rem; color: var(--muted); line-height: 1.5; margin-bottom: 10px; }
  .badge { display: inline-block; background: #ffffff10; border: 1px solid var(--border);
            border-radius: 4px; padding: 1px 7px; font-size: .72rem; color: var(--text);
            margin: 2px; font-family: monospace; }
  .badge.required { border-color: var(--accent); color: var(--accent); }
  button.try { margin-top: 10px; background: var(--accent); color: #fff; border: none;
               border-radius: 5px; padding: 6px 14px; font-size: .8rem; cursor: pointer;
               transition: opacity .15s; }
  button.try:hover { opacity: .85; }
  .form-row { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .form-row label { font-size: .75rem; color: var(--muted); }
  .form-row input, .form-row textarea {
    background: var(--bg); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text); padding: 7px 10px; font-size: .83rem; font-family: inherit;
    outline: none; transition: border-color .15s; }
  .form-row input:focus, .form-row textarea:focus { border-color: var(--accent); }
  .form-row textarea { resize: vertical; min-height: 60px; }
  pre.result { background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
               padding: 12px; font-size: .78rem; overflow-x: auto; white-space: pre-wrap;
               color: #a5f3fc; margin-top: 12px; max-height: 400px; overflow-y: auto; }
  .uri-tag { font-family: monospace; font-size: .8rem; color: var(--accent2); }
  .empty { color: var(--muted); font-size: .85rem; font-style: italic; }
  #status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--yellow); }
  #status-dot.ok  { background: var(--green); }
  #status-dot.err { background: var(--red); }
</style>
</head>
<body>

<header>
  <div id="status-dot"></div>
  <h1>MCP Explorer</h1>
  <span id="status-pill" class="pill">connecting…</span>
</header>

<main>
<nav id="nav">
  <h2>Tools</h2>
  <div id="nav-tools"></div>
  <h2>Resources</h2>
  <div id="nav-resources"></div>
  <h2>Prompts</h2>
  <div id="nav-prompts"></div>
</nav>

<div class="content" id="panels">
  <div class="panel active" id="panel-home">
    <h3>Welcome</h3>
    <p style="color:var(--muted);font-size:.85rem;line-height:1.7">
      Select a tool, resource, or prompt from the sidebar to explore.<br>
      This UI talks to <code style="color:var(--accent)">mcp_server.py</code> via an MCP client session
      and shows you the live responses from your RAG backend.
    </p>
  </div>
</div>
</main>

<script>
const $ = id => document.getElementById(id);

async function api(path) {
  const r = await fetch(path);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  return r.json();
}

// ── Nav helpers ───────────────────────────────────────────────────────────────

function addNavItem(container, id, label, tag) {
  const el = document.createElement('div');
  el.className = 'nav-item';
  el.dataset.panel = id;
  el.innerHTML = label + (tag ? `<span class="tag">${tag}</span>` : '');
  el.onclick = () => activate(id);
  container.appendChild(el);
}

function activate(id) {
  document.querySelectorAll('.nav-item').forEach(e => e.classList.toggle('active', e.dataset.panel === id));
  document.querySelectorAll('.panel').forEach(e => e.classList.toggle('active', e.id === 'panel-' + id));
}

function addPanel(id, html) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.id = 'panel-' + id;
  el.innerHTML = html;
  $('panels').appendChild(el);
}

// ── Tool panel ────────────────────────────────────────────────────────────────

function toolPanel(tool) {
  const fields = tool.params.map(p => {
    const req = tool.required.includes(p);
    return `<div class="form-row">
      <label>${p} ${req ? '<span style="color:var(--accent)">*</span>' : '(optional)'}</label>
      <textarea id="f-${tool.name}-${p}" rows="1"
        placeholder="${req ? 'required' : 'optional'}"></textarea>
    </div>`;
  }).join('');

  return `
    <h3>${tool.name}</h3>
    <p class="card-desc">${tool.description}</p>
    ${fields}
    <button class="try" onclick="callTool('${tool.name}', ${JSON.stringify(tool.params)})">Run tool</button>
    <pre class="result" id="result-${tool.name}">— result will appear here —</pre>
  `;
}

async function callTool(name, params) {
  const el = $('result-' + name);
  el.textContent = 'calling…';
  const args = {};
  params.forEach(p => {
    const v = document.getElementById(`f-${name}-${p}`).value.trim();
    if (v) args[p] = v;
  });
  const data = await post('/api/call-tool', {name, arguments: args});
  el.textContent = JSON.stringify(data, null, 2);
}

// ── Resource panel ────────────────────────────────────────────────────────────

function resourcePanel(r) {
  return `
    <h3>Resource</h3>
    <p class="uri-tag">${r.uri}</p>
    <p class="card-desc" style="margin-top:8px">${r.description}</p>
    <button class="try" onclick="readResource('${r.uri}')">Read resource</button>
    <pre class="result" id="result-res-${btoa(r.uri)}">— content will appear here —</pre>
  `;
}

async function readResource(uri) {
  const el = document.getElementById('result-res-' + btoa(uri));
  el.textContent = 'fetching…';
  const data = await api('/api/read-resource?uri=' + encodeURIComponent(uri));
  el.textContent = JSON.stringify(data, null, 2);
}

// ── Prompt panel ──────────────────────────────────────────────────────────────

function promptPanel(p) {
  const fields = p.args.map(a => `
    <div class="form-row">
      <label>${a.name} ${a.required ? '<span style="color:var(--accent)">*</span>' : '(optional)'}</label>
      <input id="fp-${p.name}-${a.name}" type="text">
    </div>
  `).join('');

  return `
    <h3>${p.name}</h3>
    <p class="card-desc">${p.description}</p>
    ${fields}
    <button class="try" onclick="getPrompt('${p.name}', ${JSON.stringify(p.args.map(a=>a.name))})">Render prompt</button>
    <pre class="result" id="result-prompt-${p.name}">— rendered messages will appear here —</pre>
  `;
}

async function getPrompt(name, argNames) {
  const el = $('result-prompt-' + name);
  el.textContent = 'rendering…';
  const args = {};
  argNames.forEach(n => {
    const v = document.getElementById(`fp-${name}-${n}`).value.trim();
    if (v) args[n] = v;
  });
  const data = await api('/api/get-prompt?name=' + encodeURIComponent(name) + '&args=' + encodeURIComponent(JSON.stringify(args)));
  el.textContent = JSON.stringify(data, null, 2);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    const [tools, resources, prompts] = await Promise.all([
      api('/api/tools'), api('/api/resources'), api('/api/prompts')
    ]);

    $('status-dot').className = 'ok';
    $('status-pill').textContent = 'connected';
    $('status-pill').className = 'pill ok';

    tools.forEach(t => {
      const id = 'tool-' + t.name;
      addNavItem($('nav-tools'), id, t.name, t.params.length + ' params');
      addPanel(id, toolPanel(t));
    });

    resources.forEach(r => {
      const id = 'res-' + btoa(r.uri);
      addNavItem($('nav-resources'), id, r.uri, 'read-only');
      addPanel(id, resourcePanel(r));
    });

    prompts.forEach(p => {
      const id = 'prompt-' + p.name;
      addNavItem($('nav-prompts'), id, p.name, p.args.length + ' args');
      addPanel(id, promptPanel(p));
    });

  } catch (e) {
    $('status-dot').className = 'err';
    $('status-pill').textContent = 'error';
    $('status-pill').className = 'pill err';
  }
}

boot();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

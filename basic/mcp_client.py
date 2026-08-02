"""
MCP Client — connects to mcp_server.py and exercises all three primitives.

What this teaches:
  1. How a client spawns a server and does the initialization handshake
  2. How to discover tools / resources / prompts
  3. How to call a tool and read a resource
  4. The request/response shape at each step
"""

import asyncio
import json

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ── Where is the server? ──────────────────────────────────────────────────────
# StdioServerParameters tells the client how to SPAWN the server process.
# The client will write JSON-RPC to the process's stdin and read from stdout.
SERVER = StdioServerParameters(
    command="python3",
    args=["mcp_server.py"],
    # cwd defaults to the caller's working directory
)


def pretty(label: str, data) -> None:
    """Print a labeled JSON block so the output is easy to read."""
    print(f"\n{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}")
    if hasattr(data, "model_dump"):
        print(json.dumps(data.model_dump(), indent=2, default=str))
    elif isinstance(data, list):
        print(json.dumps([
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in data
        ], indent=2, default=str))
    else:
        print(data)


async def main() -> None:

    # ── 1. TRANSPORT LAYER ────────────────────────────────────────────────────
    # stdio_client spawns the server process and gives back two async streams:
    #   read  — bytes arriving from the server's stdout
    #   write — bytes we send to the server's stdin
    print("\n[1] Spawning server and opening stdio streams ...")
    async with stdio_client(SERVER) as (read, write):

        # ── 2. SESSION + HANDSHAKE ────────────────────────────────────────────
        # ClientSession wraps the raw streams in the MCP JSON-RPC protocol.
        # session.initialize() sends:
        #   → { method: "initialize", params: { clientInfo: ..., capabilities: ... } }
        # The server replies with its own capabilities (what it supports).
        print("[2] Opening session and performing MCP handshake ...")
        async with ClientSession(read, write) as session:
            init_result = await session.initialize()
            pretty("HANDSHAKE — server capabilities", init_result)

            # ── 3. DISCOVER TOOLS ─────────────────────────────────────────────
            # list_tools() sends:  { method: "tools/list" }
            # Server replies with name, description, and JSON Schema for each tool.
            # This is how the client (or AI) knows what tools exist and what args they take.
            print("\n[3] Discovering tools ...")
            tools_response = await session.list_tools()
            for tool in tools_response.tools:
                print(f"\n  Tool : {tool.name}")
                print(f"  Desc : {tool.description.strip()[:80]}")
                print(f"  Args : {list(tool.inputSchema.get('properties', {}).keys())}")

            # ── 4. DISCOVER RESOURCES ─────────────────────────────────────────
            # list_resources() sends: { method: "resources/list" }
            print("\n[4] Discovering resources ...")
            resources_response = await session.list_resources()
            for r in resources_response.resources:
                print(f"\n  Resource : {r.uri}")
                print(f"  Desc     : {r.description}")

            # ── 5. DISCOVER PROMPTS ───────────────────────────────────────────
            # list_prompts() sends: { method: "prompts/list" }
            print("\n[5] Discovering prompts ...")
            prompts_response = await session.list_prompts()
            for p in prompts_response.prompts:
                args = [a.name for a in (p.arguments or [])]
                print(f"\n  Prompt : {p.name}  (args: {args})")

            # ── 6. CALL A TOOL ────────────────────────────────────────────────
            # call_tool() sends:
            #   { method: "tools/call", params: { name: "...", arguments: {...} } }
            # The server executes the function and returns the result.
            print("\n[6] Calling tool: list_documents ...")
            tool_result = await session.call_tool("list_documents", arguments={})
            pretty("TOOL RESULT — list_documents", tool_result)

            # ── 7. READ A RESOURCE ────────────────────────────────────────────
            # read_resource() sends:
            #   { method: "resources/read", params: { uri: "rag://..." } }
            # The server runs the function decorated with @mcp.resource() and
            # returns its string content.
            print("\n[7] Reading resource: rag://health ...")
            resource_result = await session.read_resource("rag://health")
            pretty("RESOURCE CONTENT — rag://health", resource_result)

            # ── 8. GET A PROMPT ───────────────────────────────────────────────
            # get_prompt() sends:
            #   { method: "prompts/get", params: { name: "...", arguments: {...} } }
            # Returns the rendered message(s) — these are what an AI host would
            # inject into the conversation as a system or user message.
            print("\n[8] Fetching prompt: rag_assistant ...")
            prompt_result = await session.get_prompt(
                "rag_assistant",
                arguments={"focus_area": "machine learning"}
            )
            pretty("PROMPT MESSAGES — rag_assistant", prompt_result)

            print("\n✓ All MCP primitives exercised successfully.\n")


if __name__ == "__main__":
    asyncio.run(main())

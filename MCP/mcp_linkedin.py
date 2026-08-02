"""
LinkedIn Skills MCP Server
Searches LinkedIn (via DuckDuckGo) when a skill is not found locally.
"""
from ddgs import DDGS
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("LinkedIn Skills")


@mcp.tool()
def search_linkedin_skills(skill: str) -> list[dict]:
    """
    Search LinkedIn for a skill — courses, jobs, and learning resources.
    Called only when the skill is not found in the local vector DB.

    Args:
        skill: The skill name to search for (e.g. "Kubernetes", "Product Design").
    """
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(f'site:linkedin.com "{skill}"', max_results=6):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
            })
    return results


if __name__ == "__main__":
    mcp.run()

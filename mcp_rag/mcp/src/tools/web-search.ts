export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

const UA = 'Mozilla/5.0 (compatible; RAGMCPBot/1.0)';

/** DuckDuckGo HTML search — no API key required. Returns up to maxResults hits. */
export async function duckduckgoSearch(query: string, maxResults = 5): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`DuckDuckGo HTTP ${resp.status}`);

  const html = await resp.text();

  // Parse results from DDG HTML using regex (avoids cheerio dependency here)
  const hits: SearchHit[] = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const urls: string[] = [];
  const titles: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = resultRe.exec(html)) !== null) {
    const href = m[1].startsWith('http') ? m[1] : `https://duckduckgo.com${m[1]}`;
    urls.push(href);
    titles.push(m[2].replace(/<[^>]+>/g, '').trim());
  }

  const snippets: string[] = [];
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
    hits.push({ title: titles[i] ?? '', url: urls[i], snippet: snippets[i] ?? '' });
  }

  // Fallback: Instant Answer JSON API
  if (hits.length === 0) {
    const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const iaResp = await fetch(iaUrl, { headers: { 'Accept': 'application/json' } });
    if (iaResp.ok) {
      const data = await iaResp.json() as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      };

      if (data.AbstractText && data.AbstractURL) {
        hits.push({ title: data.Heading ?? query, url: data.AbstractURL, snippet: data.AbstractText });
      }
      for (const t of (data.RelatedTopics ?? []).slice(0, maxResults - hits.length)) {
        if (t.Text && t.FirstURL) {
          hits.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
        }
      }
    }
  }

  return hits;
}

export function formatHits(hits: SearchHit[]): string {
  if (!hits.length) return 'No results found.';
  return hits.map((h, i) =>
    `${i + 1}. ${h.title}\n   URL: ${h.url}\n   ${h.snippet}`
  ).join('\n\n');
}

import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; RAGMCPBot/1.0)';
const MAX_CHARS = 10_000;

export async function fetchUrlContent(url: string): Promise<{ title: string; text: string }> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,text/plain,*/*',
    },
    redirect: 'follow',
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const contentType = resp.headers.get('content-type') ?? '';

  if (contentType.includes('text/plain') || contentType.includes('application/json')) {
    const text = await resp.text();
    return { title: url, text: text.slice(0, MAX_CHARS) };
  }

  const html = await resp.text();
  const $ = load(html);

  // Remove noise
  $('script, style, nav, footer, header, aside, .sidebar, .nav, .menu, [role="navigation"]').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || url;

  // Try to get the main content area
  const mainSel = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry-content'];
  let text = '';
  for (const sel of mainSel) {
    const el = $(sel).first();
    if (el.length) { text = el.text(); break; }
  }
  if (!text) text = $('body').text();

  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  return { title, text: cleaned };
}

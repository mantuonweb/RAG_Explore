import { duckduckgoSearch, formatHits, SearchHit } from './web-search';
import { fetchUrlContent } from './fetch-url';

const LINKEDIN_NOTE =
  '\n\n⚠️  LinkedIn requires login to view full profiles. ' +
  'Use fetch_url with a profile URL to attempt fetching public data (may return limited info).';

/** Search for a LinkedIn profile via web search */
export async function linkedinSearch(name: string, company?: string): Promise<string> {
  const query = company
    ? `site:linkedin.com/in "${name}" "${company}"`
    : `site:linkedin.com/in "${name}"`;

  const hits = await duckduckgoSearch(query, 5);
  const liHits = hits.filter((h) => h.url.includes('linkedin.com/in/'));

  if (!liHits.length) {
    // Broader search without site: restriction
    const broadHits = await duckduckgoSearch(`${name} linkedin profile${company ? ` ${company}` : ''}`, 5);
    const found = broadHits.filter((h) => h.url.includes('linkedin.com/in/'));
    if (!found.length) {
      return `No LinkedIn profiles found for "${name}"${company ? ` at "${company}"` : ''}.${LINKEDIN_NOTE}`;
    }
    return formatHits(found) + LINKEDIN_NOTE;
  }

  return formatHits(liHits) + LINKEDIN_NOTE;
}

/** Attempt to fetch public LinkedIn profile content */
export async function linkedinFetch(profileUrl: string): Promise<string> {
  if (!profileUrl.includes('linkedin.com')) {
    throw new Error('URL does not appear to be a LinkedIn URL');
  }
  try {
    const { title, text } = await fetchUrlContent(profileUrl);
    if (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('join now')) {
      return `LinkedIn requires login to view full profile at ${profileUrl}.\n\nPartial data:\nTitle: ${title}\n${text.slice(0, 500)}`;
    }
    return `Profile: ${title}\n\n${text}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch LinkedIn profile: ${msg}`);
  }
}

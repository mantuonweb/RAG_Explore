import { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { PDFParse } from 'pdf-parse';
import { Document } from '@langchain/core/documents';
import { createVectorStore, textSplitter, llm } from '../lib/langchain';
import { pool } from '../lib/db';
import config from '../config/env';
import { webSearch } from '../lib/mcp-client';
import type { DocumentUpdateBody } from '../types/document';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single('file');

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;
  let text: string;

  if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } catch (err) {
      console.error('[pdf-parse error]', err);
      res.status(422).json({ error: 'Failed to parse PDF' });
      return;
    } finally {
      await parser.destroy();
    }
  } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
    text = buffer.toString('utf-8');
  } else {
    res.status(400).json({ error: 'Unsupported file type. Use .txt or .pdf' });
    return;
  }

  if (!text.trim()) {
    res.status(422).json({ error: 'File contains no extractable text' });
    return;
  }

  try {
    const documentId = randomUUID();
    const uploadedAt = new Date().toISOString();
    const chunks = await textSplitter.splitText(text);

    const docs = chunks.map((chunk, chunkIndex) =>
      new Document({
        pageContent: chunk,
        metadata: { documentId, sourceFile: originalname, chunkIndex, uploadedAt },
      })
    );

    const vectorStore = await createVectorStore();
    await vectorStore.addDocuments(docs);

    res.status(201).json({ documentId, sourceFile: originalname, chunkCount: chunks.length });
  } catch (err: unknown) {
    console.error('[upload embed error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to embed document', detail: message });
  }
}

export async function listDocuments(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(`
      SELECT
        metadata->>'documentId'      AS "documentId",
        metadata->>'sourceFile'      AS "sourceFile",
        COUNT(*)::int                AS "chunkCount",
        MIN(metadata->>'uploadedAt') AS "uploadedAt"
      FROM documents
      WHERE metadata->>'documentId' IS NOT NULL
      GROUP BY metadata->>'documentId', metadata->>'sourceFile'
      ORDER BY MIN(metadata->>'uploadedAt') DESC
    `);
    res.json({ documents: rows });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '42P01') {
      res.json({ documents: [] });
      return;
    }
    throw err;
  }
}

export async function searchDocuments(req: Request, res: Response): Promise<void> {
  const { query, k = 5 } = req.body as { query?: string; k?: number };

  if (!query?.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  try {
    const vectorStore = await createVectorStore();
    const rawResults = await vectorStore.similaritySearchWithScore(query, Number(k));

    const results = rawResults.map(([doc, score]) => ({
      content: doc.pageContent,
      score,
      metadata: doc.metadata,
    }));

    res.json({ results });
  } catch (err: unknown) {
    console.error('[search error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Search failed', detail: message });
  }
}

export async function askDocument(req: Request, res: Response): Promise<void> {
  const { query, k = 5 } = req.body as { query?: string; k?: number };
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  try {
    const vectorStore = await createVectorStore();
    const rawResults = await vectorStore.similaritySearchWithScore(trimmedQuery, Number(k));

    const allSources = rawResults.map(([doc, score]) => ({
      content: doc.pageContent,
      score,
      metadata: doc.metadata,
    }));

    // Discard chunks below the similarity threshold
    const sources = allSources.filter((s) => s.score >= config.rag.minSimilarity);

    // ── No local chunks → try MCP immediately ───────────────────────────
    if (sources.length === 0) {
      console.log(`[ask] no local match for "${trimmedQuery}" — trying MCP web search`);
      const webResult = await webSearch(trimmedQuery, Number(k));

      if (!webResult) {
        res.json({ answer: null, sources: [], noMatch: true });
        return;
      }

      const webAnswer = await synthesizeFromWeb(trimmedQuery, webResult);
      res.json({ answer: webAnswer, sources: [], webSearch: true, webContext: webResult });
      return;
    }

    // ── Local chunks exist → ask LLM with sentinel for irrelevance ───────
    const context = sources
      .map((s, i) => `[Source ${i + 1} — ${s.metadata.sourceFile}]\n${s.content}`)
      .join('\n\n---\n\n');

    const rawResponse = await llm.invoke([
      {
        role: 'system',
        content:
          'You are a helpful assistant. Answer the question using ONLY the provided context.\n\n' +
          'IMPORTANT: If the context is about a COMPLETELY DIFFERENT person or subject ' +
          'and contains NO information relevant to the question, ' +
          'start your response with exactly "[NO_MATCH]" followed by a brief explanation. ' +
          'Otherwise answer directly without any prefix.',
      },
      {
        role: 'user',
        content: `Context:\n\n${context}\n\nQuestion: ${trimmedQuery}`,
      },
    ]);

    const answer =
      typeof rawResponse.content === 'string'
        ? rawResponse.content
        : (rawResponse.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('');

    // ── LLM signalled no match → try MCP, fall back to local chunks ──────
    if (answer.startsWith('[NO_MATCH]')) {
      console.log(`[ask] LLM flagged no match for "${trimmedQuery}" — trying MCP`);
      const webResult = await webSearch(trimmedQuery, Number(k));

      if (webResult) {
        const webAnswer = await synthesizeFromWeb(trimmedQuery, webResult);
        res.json({ answer: webAnswer, sources: [], webSearch: true, webContext: webResult });
        return;
      }

      // MCP unavailable — return clean no-match (sources filtered out intentionally)
      res.json({ answer: null, sources: [], noMatch: true });
      return;
    }

    res.json({ answer, sources });
  } catch (err: unknown) {
    console.error('[ask error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Ask failed', detail: message });
  }
}

async function synthesizeFromWeb(query: string, webContext: string): Promise<string> {
  const response = await llm.invoke([
    {
      role: 'system',
      content:
        'You are a helpful assistant. Answer the question using only the provided web search results. ' +
        'Be clear, concise, and well-structured.',
    },
    { role: 'user', content: `Web search results:\n\n${webContext}\n\nQuestion: ${query}` },
  ]);

  return typeof response.content === 'string'
    ? response.content
    : (response.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('');
}

export async function updateDocumentMetadata(req: Request, res: Response): Promise<void> {
  const { documentId } = req.params as { documentId: string };
  const { text, tags, description, sourceFile } = req.body as DocumentUpdateBody;

  if (!text && tags === undefined && description === undefined && sourceFile === undefined) {
    res.status(400).json({ error: 'Provide at least one field: text, tags, description, or sourceFile' });
    return;
  }

  try {
    // Verify document exists
    const { rows } = await pool.query(
      `SELECT metadata->>'sourceFile' AS "sourceFile", metadata->>'uploadedAt' AS "uploadedAt"
       FROM documents WHERE metadata->>'documentId' = $1 LIMIT 1`,
      [documentId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Re-chunk and re-embed when text content changes
    if (text?.trim()) {
      const existingMeta = rows[0] as { sourceFile: string; uploadedAt: string };
      const updatedAt = new Date().toISOString();

      const chunks = await textSplitter.splitText(text);
      const docs = chunks.map((chunk, chunkIndex) =>
        new Document({
          pageContent: chunk,
          metadata: {
            documentId,
            sourceFile: sourceFile ?? existingMeta.sourceFile,
            chunkIndex,
            uploadedAt: existingMeta.uploadedAt,
            updatedAt,
            ...(tags !== undefined && { tags }),
            ...(description !== undefined && { description }),
          },
        })
      );

      await pool.query(`DELETE FROM documents WHERE metadata->>'documentId' = $1`, [documentId]);
      const vectorStore = await createVectorStore();
      await vectorStore.addDocuments(docs);

      res.json({ documentId, chunkCount: chunks.length, reEmbedded: true });
      return;
    }

    // Metadata-only update (no re-embedding needed)
    const patch: Record<string, unknown> = {};
    if (sourceFile !== undefined) patch.sourceFile = sourceFile;
    if (tags !== undefined) patch.tags = tags;
    if (description !== undefined) patch.description = description;

    const { rowCount } = await pool.query(
      `UPDATE documents SET metadata = metadata || $1::jsonb WHERE metadata->>'documentId' = $2`,
      [JSON.stringify(patch), documentId]
    );

    res.json({ documentId, updated: rowCount, patch });
  } catch (err: unknown) {
    console.error('[update error]', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Update failed', detail: message });
  }
}

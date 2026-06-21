import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:8000';

export interface QueryResponse {
  answer: string;
}

export interface IngestResponse {
  doc_id: string;
  filename: string;
  chunks_indexed: number;
}

export interface DocumentChunk {
  id: string;
  content: string;
  source: string;
  page: number;
}

export interface DocumentSource {
  doc_id: string;
  source: string;
  filename: string;
  doc_name: string;
  doc_description: string;
  chunk_count: number;
}

@Injectable({ providedIn: 'root' })
export class RagApiService {
  constructor(private http: HttpClient) {}

  query(question: string, docId?: string): Observable<QueryResponse> {
    return this.http.post<QueryResponse>(`${API_BASE}/query`, {
      question,
      doc_id: docId ?? null,
    });
  }

  ingestFile(file: File, name: string, description: string): Observable<IngestResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    form.append('description', description);
    return this.http.post<IngestResponse>(`${API_BASE}/ingest`, form);
  }

  // Document-level
  getSources(): Observable<DocumentSource[]> {
    return this.http.get<DocumentSource[]>(`${API_BASE}/documents/sources`);
  }

  deleteByDocId(docId: string): Observable<{ doc_id: string; chunks_deleted: number }> {
    return this.http.delete<{ doc_id: string; chunks_deleted: number }>(
      `${API_BASE}/documents/by-doc`,
      { params: { doc_id: docId } },
    );
  }

  // Chunk-level
  getChunks(source?: string): Observable<DocumentChunk[]> {
    const params: Record<string, string> = {};
    if (source) params['source'] = source;
    return this.http.get<DocumentChunk[]>(`${API_BASE}/documents`, { params });
  }

  getDocument(id: string): Observable<DocumentChunk> {
    return this.http.get<DocumentChunk>(`${API_BASE}/documents/${id}`);
  }

  updateDocument(id: string, content: string): Observable<{ id: string; updated: boolean }> {
    return this.http.put<{ id: string; updated: boolean }>(`${API_BASE}/documents/${id}`, { content });
  }

  deleteDocument(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${API_BASE}/documents/${id}`);
  }
}

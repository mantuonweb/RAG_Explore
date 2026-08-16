import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AskResult, DocumentInfo, SearchResult, UploadResult } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/documents';

  upload(file: File): Observable<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadResult>(`${this.apiUrl}/upload`, form);
  }

  list(): Observable<{ documents: DocumentInfo[] }> {
    return this.http.get<{ documents: DocumentInfo[] }>(this.apiUrl);
  }

  search(query: string, k = 5): Observable<{ results: SearchResult[] }> {
    return this.http.post<{ results: SearchResult[] }>(`${this.apiUrl}/search`, { query, k });
  }

  ask(query: string, k = 5): Observable<AskResult> {
    return this.http.post<AskResult>(`${this.apiUrl}/ask`, { query, k });
  }

  updateMetadata(
    documentId: string,
    patch: { tags?: string[]; description?: string; sourceFile?: string }
  ): Observable<{ documentId: string; updated: number; patch: typeof patch }> {
    return this.http.patch<{ documentId: string; updated: number; patch: typeof patch }>(
      `${this.apiUrl}/${documentId}`,
      patch
    );
  }
}

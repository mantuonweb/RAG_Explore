export interface UploadResult {
  documentId: string;
  sourceFile: string;
  chunkCount: number;
}

export interface DocumentInfo {
  documentId: string;
  sourceFile: string;
  chunkCount: number;
  uploadedAt: string;
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: {
    documentId: string;
    sourceFile: string;
    chunkIndex: number;
    uploadedAt: string;
  };
}

export interface AskResult {
  answer: string | null;
  sources: SearchResult[];
  noMatch?: boolean;
  webSearch?: boolean;
  webContext?: string;
}

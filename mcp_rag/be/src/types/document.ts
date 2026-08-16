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

export interface DocumentUpdateBody {
  text?: string;
  sourceFile?: string;
  tags?: string[];
  description?: string;
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

import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/pgvector';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PoolConfig } from 'pg';
import config from '../config/env';

export const llm = new ChatOpenAI({
  model: config.openai.llmModel,
  apiKey: config.openai.apiKey,
});

export const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: config.chunk.size,
  chunkOverlap: config.chunk.overlap,
});

const pgConfig: PoolConfig = {
  connectionString: config.db.postgresUrl,
};

export function createVectorStore(): Promise<PGVectorStore> {
  return PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: pgConfig,
    tableName: 'documents',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'content',
      metadataColumnName: 'metadata',
    },
  });
}

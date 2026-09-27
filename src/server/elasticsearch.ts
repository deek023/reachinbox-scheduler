import "dotenv/config";
import { Client } from '@elastic/elasticsearch';
import type { EmailRecord, EmailStatus } from '../types/email.ts';

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';
const INDEX_NAME = 'emails';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY || '';

let isConnected = false;
let lastError: string | null = null;

export const esClient = new Client({
  node: ELASTICSEARCH_URL,
  auth: ELASTICSEARCH_API_KEY ? { apiKey: ELASTICSEARCH_API_KEY } : undefined,
  maxRetries: 2,
  requestTimeout: 4000,
});

export function isElasticsearchConnected(): boolean {
  return isConnected;
}

export function getElasticsearchStatus() {
  return {
    connected: isConnected,
    node: ELASTICSEARCH_URL,
    index: INDEX_NAME,
    error: lastError,
  };
}

export async function initElasticsearch(): Promise<boolean> {
  try {
    await esClient.info();
    isConnected = true;
    lastError = null;
    console.log(`[Elasticsearch] Connected to serverless cluster at ${ELASTICSEARCH_URL}`);

    // Check if index exists; if not, create it
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!indexExists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderName: { type: 'text' },
            senderEmail: { type: 'keyword' },
            recipient: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            previewUrl: { type: 'keyword' },
            messageId: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Created index '${INDEX_NAME}' with mappings.`);
    }

    return true;
  } catch (err: unknown) {
    isConnected = false;
    lastError = err instanceof Error ? err.message : String(err);
    console.warn(`[Elasticsearch] Unavailable at ${ELASTICSEARCH_URL}:`, lastError);
    return false;
  }
}

export async function indexEmailDocument(email: EmailRecord): Promise<void> {
  if (!isConnected) return;
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        senderId: email.senderId,
        senderName: email.senderName,
        senderEmail: email.senderEmail,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        previewUrl: email.previewUrl,
        messageId: email.messageId,
        createdAt: email.createdAt,
      },
      refresh: 'wait_for',
    });
  } catch (err: unknown) {
    console.error(`[Elasticsearch] Failed to index email ${email.id}:`, err instanceof Error ? err.message : String(err));
  }
}

export async function deleteEmailDocument(id: string): Promise<void> {
  if (!isConnected) return;
  try {
    await esClient.delete({
      index: INDEX_NAME,
      id,
    });
  } catch (err: unknown) {
    // Ignore not found errors during deletion
  }
}

export interface ElasticsearchSearchOptions {
  query?: string;
  status?: EmailStatus;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ElasticsearchSearchResult {
  connected: boolean;
  error?: string;
  hits: Array<EmailRecord & { score: number; highlight?: { field: string; snippet: string } }>;
  total: number;
  facets: {
    byStatus: Record<string, number>;
  };
}

export async function searchEmailDocuments(options: ElasticsearchSearchOptions): Promise<ElasticsearchSearchResult> {
  if (!isConnected) {
    return {
      connected: false,
      error: `Elasticsearch service is not reachable at ${ELASTICSEARCH_URL}. Please start Elasticsearch (e.g., docker compose up -d elasticsearch) to enable full-text indexing.`,
      hits: [],
      total: 0,
      facets: { byStatus: {} },
    };
  }

  try {
    const mustClauses: any[] = [];

    if (options.userId) {
      mustClauses.push({ term: { userId: options.userId } });
    }

    if (options.status) {
      mustClauses.push({ term: { status: options.status } });
    }

    if (options.query && options.query.trim()) {
      mustClauses.push({
        multi_match: {
          query: options.query.trim(),
          fields: ['recipient^3', 'subject^2', 'body', 'senderName', 'senderEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    const query = mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} };

    const searchResponse = await esClient.search({
      index: INDEX_NAME,
      from: options.offset || 0,
      size: options.limit || 50,
      query,
      highlight: {
        fields: {
          subject: {},
          body: { fragment_size: 150, number_of_fragments: 1 },
          recipient: {},
        },
      },
      aggs: {
        statuses: {
          terms: { field: 'status' },
        },
      },
    });

    const statusCounts: Record<string, number> = {};
    const buckets = (searchResponse.aggregations?.statuses as any)?.buckets || [];
    for (const b of buckets) {
      statusCounts[b.key] = b.doc_count;
    }

    const hits: Array<EmailRecord & { score: number; highlight?: { field: string; snippet: string } }> = [];
    for (const h of searchResponse.hits.hits) {
      const source = h._source as EmailRecord;
      let hl: { field: string; snippet: string } | undefined;
      if (h.highlight) {
        if (h.highlight.subject) {
          hl = { field: 'subject', snippet: h.highlight.subject[0] };
        } else if (h.highlight.recipient) {
          hl = { field: 'recipient', snippet: h.highlight.recipient[0] };
        } else if (h.highlight.body) {
          hl = { field: 'body', snippet: h.highlight.body[0] };
        }
      }

      hits.push({
        ...source,
        score: h._score || 1.0,
        highlight: hl,
      });
    }

    const total =
      typeof searchResponse.hits.total === 'number'
        ? searchResponse.hits.total
        : searchResponse.hits.total?.value || hits.length;

    return {
      connected: true,
      hits,
      total,
      facets: { byStatus: statusCounts },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Elasticsearch Search Error]:', errorMsg);
    return {
      connected: false,
      error: errorMsg,
      hits: [],
      total: 0,
      facets: { byStatus: {} },
    };
  }
}

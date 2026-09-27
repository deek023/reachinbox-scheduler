import {
  initElasticsearch,
  indexEmailDocument,
  deleteEmailDocument,
  searchEmailDocuments,
  getElasticsearchStatus,
  isElasticsearchConnected,
} from './elasticsearch.ts';
import type { EmailRecord, EmailStatus } from '../types/email.ts';

export const searchIndex = {
  init: initElasticsearch,
  indexEmail: indexEmailDocument,
  removeEmail: deleteEmailDocument,
  search: (options: {
    query?: string;
    userId?: string;
    status?: EmailStatus;
    limit?: number;
    offset?: number;
  }) => searchEmailDocuments(options),
  getStatus: getElasticsearchStatus,
  isConnected: isElasticsearchConnected,
};

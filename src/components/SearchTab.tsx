import React, { useState } from 'react';
import { Search, ExternalLink, AlertTriangle } from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';
import { searchEmails } from '../services/api.ts';

interface SearchTabProps {
  onViewDetails: (email: EmailRecord) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({ onViewDetails }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [results, setResults] = useState<
    Array<EmailRecord & { score: number; highlight?: { field: string; snippet: string } }>
  >([]);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [esConnected, setEsConnected] = useState<boolean | null>(null);
  const [esError, setEsError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    setEsError(null);

    try {
      const data = await searchEmails(query, statusFilter);
      setEsConnected(data.connected);
      if (!data.connected) {
        setEsError(data.error || 'Elasticsearch cluster is currently offline.');
        setResults([]);
        setTotal(0);
      } else {
        setResults(data.hits || []);
        setTotal(data.total || 0);
        setFacets(data.facets?.byStatus || {});
      }
    } catch (err: unknown) {
      setEsConnected(false);
      setEsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Header Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center space-x-2.5 mb-3">
          <div className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Elasticsearch Full-Text Query
            </h3>
            <p className="text-[11px] text-slate-400">
              Query recipient, subject, body, and status with BM25 relevance scoring
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across emails index (recipient, subject, body)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
            </select>

            <button
              type="submit"
              disabled={isSearching}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </form>

        {/* Facet summary badges */}
        {Object.keys(facets).length > 0 && (
          <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Indexed Counts:</span>
            {Object.entries(facets).map(([status, count]) => (
              <span
                key={status}
                className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] font-mono border border-slate-800"
              >
                {status}: <strong className="text-blue-400">{count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Elasticsearch Unavailable Notice */}
      {esConnected === false && esError && (
        <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 flex items-start space-x-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white text-xs uppercase tracking-wider">
              Elasticsearch Service Offline
            </p>
            <p className="text-[11px] text-amber-300 leading-relaxed">{esError}</p>
            <p className="text-[11px] text-slate-400 pt-1">
              Start Elasticsearch locally:
            </p>
            <code className="block bg-slate-950 p-2 rounded text-blue-400 font-mono text-[10px] mt-0.5 border border-slate-800 select-all">
              docker run -d -p 9200:9200 -e &quot;discovery.type=single-node&quot; -e &quot;xpack.security.enabled=false&quot; elasticsearch:8.11.0
            </code>
          </div>
        </div>
      )}

      {/* Results List */}
      {hasSearched && esConnected && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Elasticsearch Matches ({results.length})
            </span>
            {total !== null && (
              <span className="text-[11px] text-slate-400 font-mono">
                BM25 Score Ranked
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-800">
            {isSearching ? (
              // Realistic Skeleton Loader Rows (Rule 20)
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                  <div className="h-3.5 bg-slate-800 rounded w-1/2" />
                  <div className="h-3 bg-slate-800/60 rounded w-3/4" />
                </div>
              ))
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No matching email records found in the Elasticsearch index for &quot;{query}&quot;.
              </div>
            ) : (
              results.map((hit) => (
                <div key={hit.id} className="p-3.5 hover:bg-slate-800/40 transition-colors text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-white">{hit.recipient}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                          hit.status === 'SENT'
                            ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/60'
                            : hit.status === 'SCHEDULED'
                            ? 'text-blue-400 bg-blue-950/40 border border-blue-800/60'
                            : 'text-amber-400 bg-amber-950/40 border border-amber-800/60'
                        }`}
                      >
                        {hit.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Score: {hit.score.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {hit.previewUrl && (
                        <a
                          href={hit.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-[11px] transition-colors"
                        >
                          <span>Preview</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onViewDetails(hit)}
                        className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-[11px] transition-colors"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-200">{hit.subject}</h4>
                    {hit.highlight ? (
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        <strong className="text-blue-400 uppercase text-[9px] mr-1">
                          [{hit.highlight.field}]:
                        </strong>
                        <span className="italic">{hit.highlight.snippet}</span>
                      </p>
                    ) : (
                      <p className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">{hit.body}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-[10px] text-slate-500 pt-0.5 font-mono">
                    <span>Sender: {hit.senderEmail}</span>
                    <span>Scheduled: {new Date(hit.scheduledAt).toLocaleString()}</span>
                    <span>Job ID: {hit.bullmqJobId || 'N/A'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

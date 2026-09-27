import React, { useState } from 'react';
import { Search, Eye, Sparkles, ExternalLink, AlertTriangle, Database } from 'lucide-react';
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
    <div className="space-y-5">
      {/* Search Header Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Official Elasticsearch Search</h3>
            <p className="text-xs text-slate-400">
              Real @elastic/elasticsearch queries matching recipient, subject, body, and status with scoring
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across emails index (recipient, subject, body)..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isSearching ? 'Searching...' : 'Search Cluster'}</span>
            </button>
          </div>
        </form>

        {/* Facet summary badges */}
        {Object.keys(facets).length > 0 && (
          <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Indexed counts:</span>
            {Object.entries(facets).map(([status, count]) => (
              <span
                key={status}
                className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700"
              >
                {status}: <strong className="text-indigo-300">{count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Elasticsearch Unavailable Notice */}
      {esConnected === false && esError && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Elasticsearch Service Offline</p>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">{esError}</p>
            <p className="text-[11px] text-slate-400 pt-1">
              To run Elasticsearch locally with Docker:
            </p>
            <code className="block bg-slate-900 p-2 rounded text-indigo-300 font-mono text-[10px] mt-1 select-all">
              docker run -d -p 9200:9200 -e &quot;discovery.type=single-node&quot; -e &quot;xpack.security.enabled=false&quot; elasticsearch:8.11.0
            </code>
          </div>
        </div>
      )}

      {/* Results List */}
      {hasSearched && esConnected && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Elasticsearch Hits ({results.length} found)
            </span>
            {total !== null && (
              <span className="text-[11px] text-slate-400 font-mono">Matched score ranking</span>
            )}
          </div>

          <div className="divide-y divide-slate-800/80">
            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No matching email records found in the Elasticsearch index for &quot;{query}&quot;.
              </div>
            ) : (
              results.map((hit) => (
                <div key={hit.id} className="p-4 hover:bg-slate-800/40 transition text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-white">{hit.recipient}</span>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-medium ${
                          hit.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : hit.status === 'SCHEDULED'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {hit.status}
                      </span>
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
                        Score: {hit.score.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {hit.previewUrl && (
                        <a
                          href={hit.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 text-[11px]"
                        >
                          <span>Ethereal Preview</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        onClick={() => onViewDetails(hit)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px]"
                      >
                        View Full
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-200">{hit.subject}</h4>
                    {hit.highlight ? (
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        <strong className="text-indigo-300 uppercase text-[9px] mr-1">
                          [{hit.highlight.field}]:
                        </strong>
                        <span className="italic">{hit.highlight.snippet}</span>
                      </p>
                    ) : (
                      <p className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">{hit.body}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-[10px] text-slate-500 pt-1 font-mono">
                    <span>Sender: {hit.senderEmail}</span>
                    <span>Scheduled: {new Date(hit.scheduledAt).toLocaleString()}</span>
                    <span>Job: {hit.bullmqJobId || 'N/A'}</span>
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

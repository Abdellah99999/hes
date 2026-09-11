import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading = false,
  emptyMessage = "Aucun élément trouvé",
  actions,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(total, page * limit);

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800/80 text-[11px]">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3.5 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span>Chargement des données serveur...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-500 italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={item.id ? String(item.id) : idx}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                      {col.render
                        ? col.render(item)
                        : (item as Record<string, unknown>)[col.key] != null
                          ? String((item as Record<string, unknown>)[col.key])
                          : "-"}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 text-right">{actions(item)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="px-4 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            Affichage de <strong className="text-slate-200">{startItem}</strong> à{" "}
            <strong className="text-slate-200">{endItem}</strong> sur{" "}
            <strong className="text-slate-200">{total}</strong> résultats
          </span>
          {onLimitChange && (
            <div className="flex items-center gap-1.5">
              <span>Lignes:</span>
              <select
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            aria-label="Première page"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            aria-label="Page précédente"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 font-mono text-slate-200 bg-slate-950/80 border border-slate-800/80 rounded-lg">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            aria-label="Page suivante"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            aria-label="Dernière page"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

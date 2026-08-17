"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface DataTableColumn<T> {
  /** Unique key; used for sorting identification. */
  key: string;
  /** Column header label. */
  header: string;
  /** Optional — columns without an accessor are not sortable. */
  sortValue?: (row: T) => string | number;
  /** Render the cell content for a row. */
  render: (row: T) => ReactNode;
  /** Default column header className. */
  className?: string;
  /** Hide this column on small screens (for dense tables). */
  hideBelow?: "sm" | "md";
}

export interface DataTableFilter<T> {
  /** Column key this filter applies to. */
  key: string;
  /** Predicate used to decide whether a row passes. */
  test: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Row key accessor for React keys. */
  rowKey: (row: T) => string;
  /** Active filters (predicates against rows). */
  filters?: DataTableFilter<T>[];
  /** Empty state message. */
  emptyMessage?: string;
  /** Page size options. */
  pageSizes?: number[];
  defaultPageSize?: number;
}

const SORT_ICONS: Record<"asc" | "desc" | "none", string> = {
  asc: " ↑",
  desc: " ↓",
  none: "",
};

/** A generic, reusable client-side data table with filtering, sorting and paging. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  filters = [],
  emptyMessage = "No records.",
  pageSizes = [20, 50, 100],
  defaultPageSize = 20,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Filtered rows.
  const filtered = useMemo(() => {
    if (filters.length === 0) return rows;
    return rows.filter((row) => filters.every((f) => f.test(row)));
  }, [rows, filters]);

  // Sorted rows.
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey && c.sortValue);
    if (!col?.sortValue) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, columns, sortKey, sortDir]);

  // Paginated rows.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const handleSort = (key: string, sortValue?: (row: T) => string | number) => {
    if (!sortValue) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 font-medium",
                    col.sortValue && "cursor-pointer select-none hover:text-foreground",
                    col.hideBelow === "md" && "hidden md:table-cell",
                    col.hideBelow === "sm" && "hidden sm:table-cell",
                    col.className,
                  )}
                  onClick={() => handleSort(col.key, col.sortValue)}
                >
                  {col.header}
                  {col.sortValue && SORT_ICONS[sortKey === col.key ? sortDir : "none"]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-muted/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2",
                      col.hideBelow === "md" && "hidden md:table-cell",
                      col.hideBelow === "sm" && "hidden sm:table-cell",
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paging controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-border bg-card px-2 text-sm"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {sorted.length === 0
              ? "0"
              : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)}`}{" "}
            of {sorted.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="h-8 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-40"
          >
            ‹
          </button>
          <span className="min-w-10 text-center">{safePage}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="h-8 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";

// ─── Column config ────────────────────────────────────────────────────────────
/** Preferred column order when these keys exist; any other API fields follow alphabetically. */
const PREFERRED_COLUMN_ORDER: string[] = [
  "project_id",
  "homeowner_name",
  "homeowner_email",
  "homeowner_phone",
  "project_street_address",
  "project_city",
  "project_state",
  "project_status",
  "sales_rep_name",
  "system_size",
  "primary_finance_company",
  "primary_finance_amount",
  "install_status",
  "pto_approved",
];

/** Stable display / CSV headers (matches original table labels). */
const COLUMN_HEADER_LABELS: Record<string, string> = {
  project_id: "Project ID",
  homeowner_name: "Homeowner",
  homeowner_email: "Email",
  homeowner_phone: "Phone",
  project_street_address: "Address",
  project_city: "City",
  project_state: "State",
  project_status: "Status",
  sales_rep_name: "Sales Rep",
  system_size: "System Size (kW)",
  primary_finance_company: "Finance Co.",
  primary_finance_amount: "Finance Amount",
  install_status: "Install Status",
  pto_approved: "PTO Approved",
};

type Row = Record<string, unknown>;

/** Human-readable header from snake_case key (fallback for unknown API fields) */
function labelForKey(key: string): string {
  return key
    .split(/_/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function headerLabelForKey(key: string): string {
  return COLUMN_HEADER_LABELS[key] ?? labelForKey(key);
}

/** All keys present in rows: preferred order first, then remaining keys A–Z */
function getColumnKeys(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const present = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => present.add(k));
  });
  const ordered: string[] = [];
  for (const k of PREFERRED_COLUMN_ORDER) {
    if (present.has(k)) ordered.push(k);
  }
  const rest = Array.from(present)
    .filter((k) => !ordered.includes(k))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Rows per request when building CSV (keeps each response under Lambda limits). */
const EXPORT_CHUNK_SIZE = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** e.g. "January 16, 2026" */
function formatLongUSDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isReasonableCalendarDate(d: Date): boolean {
  const y = d.getFullYear();
  return y >= 1970 && y <= 2100;
}

/** Parse calendar date from YYYY-MM-DD in local time (avoids UTC off-by-one). */
function parseIsoDateOnlyLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== mo ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function tryParseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) || !isReasonableCalendarDate(value)
      ? null
      : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms =
      value > 1e12 ? value : value > 1e9 && value < 1e12 ? value * 1000 : NaN;
    if (Number.isNaN(ms)) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) || !isReasonableCalendarDate(d) ? null : d;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "null" || t === "undefined") return null;
    const dateOnly = parseIsoDateOnlyLocal(t);
    if (dateOnly) return dateOnly;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const d = new Date(t);
      return Number.isNaN(d.getTime()) || !isReasonableCalendarDate(d)
        ? null
        : d;
    }
    if (/^\d{10,13}$/.test(t)) {
      const n = Number(t);
      const ms = n > 1e12 ? n : n * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) || !isReasonableCalendarDate(d)
        ? null
        : d;
    }
  }
  return null;
}

function formatScalarForDisplay(value: unknown): string | null {
  const d = tryParseDate(value);
  if (d) return formatLongUSDate(d);
  return null;
}

/**
 * CSV export cell values — match legacy export:
 * dates as full ISO UTC (e.g. 2020-12-18T08:00:00.000Z), plain strings for the rest.
 */
function stringifyCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  const d = tryParseDate(value);
  if (d) {
    return d.toISOString();
  }
  const s = String(value);
  if (s === "null" || s === "undefined") return "";
  return s;
}

/** Tooltip / title attribute — plain text, can use long US date */
function stringifyField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  const formatted = formatScalarForDisplay(value);
  if (formatted !== null) return formatted;
  const s = String(value);
  if (s === "null" || s === "undefined") return "";
  return s;
}

function cellDisplay(_key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    const s = JSON.stringify(value);
    return s.length > 120 ? `${s.slice(0, 120)}…` : s;
  }
  const formatted = formatScalarForDisplay(value);
  if (formatted !== null) return formatted;
  const str = String(value);
  if (!str || str === "null" || str === "undefined") return "—";
  return str;
}

/** CSV is fixed 14 columns (original spec) — not every API field (avoids huge multiline cells). */
function convertToCSV(rows: Row[]): string {
  if (rows.length === 0) return "";
  const keys = PREFERRED_COLUMN_ORDER;
  const header = keys
    .map((k) => `"${headerLabelForKey(k).replace(/"/g, '""')}"`)
    .join(",");
  const body = rows.map((row) =>
    keys
      .map((k) => {
        const val = stringifyCsvCell(row[k]).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\r\n");
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Sliding window of up to 11 page numbers centred on current page
function getPageWindow(current: number, total: number): number[] {
  const WINDOW = 11;
  let start = Math.max(1, current - Math.floor(WINDOW / 2));
  const end = Math.min(total, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Skeleton widths — deterministic, no random
const SKELETON_W = [
  "72%", "58%", "80%", "55%", "74%", "48%", "62%",
  "70%", "66%", "56%", "60%", "44%", "68%", "50%",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PaginationBarProps {
  page: number;
  totalPages: number;
  pageSize: number;
  count: number;
  loading: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

function PaginationBar({
  page,
  totalPages,
  pageSize,
  count,
  loading,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const [inputVal, setInputVal] = useState(String(page));

  // Keep input in sync when page changes externally
  useEffect(() => {
    setInputVal(String(page));
  }, [page]);

  function commitPage(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
    } else {
      setInputVal(String(page));
    }
  }

  const pages = getPageWindow(page, totalPages);

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-y-3 border-t border-gray-200 bg-white px-4 py-3">
      {/* Left: Page X of Y */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Page:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={(e) => commitPage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitPage(inputVal)}
          className="w-12 rounded border border-gray-300 px-2 py-1 text-center text-sm text-gray-900 outline-none focus:border-[#8b0000] focus:ring-1 focus:ring-[#8b0000]/30"
        />
        <span>of {loading ? "…" : totalPages.toLocaleString()}</span>
      </div>

      {/* Center: Page number buttons */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || loading}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="First page"
        >
          «
        </button>
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Page numbers */}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={loading}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition cursor-pointer ${
              p === page
                ? "bg-[#8b0000] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="Next page"
        >
          ›
        </button>
        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || loading}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="Last page"
        >
          »
        </button>
      </div>

      {/* Right: Items per page */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Items per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={loading}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#8b0000] cursor-pointer"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {!loading && (
          <span className="text-gray-400">
            ({count.toLocaleString()} total)
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface QueryState {
  term: string;
  page: number;
  pageSize: number;
}

export default function ProjectsTable() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<QueryState>({
    term: "",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Stable total — survives page navigation; only resets on new search term
  const stableCountRef = useRef(0);
  const lastTermRef = useRef<string | null>(null);

  /** All fields from API rows; keep last known columns when current page is empty */
  const columnKeysRef = useRef<string[]>([]);
  const columnKeys = useMemo(() => {
    const keys = getColumnKeys(rows);
    if (keys.length > 0) {
      columnKeysRef.current = keys;
      return keys;
    }
    return columnKeysRef.current;
  }, [rows]);

  const skeletonColCount = Math.max(columnKeys.length, 14);

  const totalPages = Math.max(1, Math.ceil(count / query.pageSize));

  // Debounce search → reset to page 1 (skip on initial mount to avoid cancelling the first fetch)
  const isMountedSearch = useRef(true);
  useEffect(() => {
    if (isMountedSearch.current) {
      isMountedSearch.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, term: search, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data whenever query changes
  const parseProjectsResponse = useCallback((json: {
    body?: unknown;
  }): { data: Row[]; count: number } => {
    let body = json.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body) as { data?: Row[]; count?: number };
      } catch {
        body = undefined;
      }
    }
    const b = body as { data?: Row[]; count?: number } | undefined;
    return {
      data: (b?.data ?? []) as Row[],
      count: (b?.count ?? 0) as number,
    };
  }, []);

  const fetchData = useCallback(
    async (term: string, page: number, pageSize: number) => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(
        `/api/projects?limit=${pageSize}&offset=${offset}&input=${encodeURIComponent(term)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return parseProjectsResponse(json);
    },
    [parseProjectsResponse]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError("");
    fetchData(query.term, query.page, query.pageSize)
      .then(({ data, count: total }) => {
        if (cancelled) return;
        setRows(data);

        // When the search term changes reset the stable count; otherwise
        // never let it shrink (API may return 0 or a stale value on late pages)
        if (query.term !== lastTermRef.current) {
          lastTermRef.current = query.term;
          stableCountRef.current = total;
        } else {
          stableCountRef.current = Math.max(stableCountRef.current, total);
        }
        setCount(stableCountRef.current);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError("Failed to load data. Please try again.");
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, fetchData]);

  function handlePageChange(p: number) {
    const clamped = Math.max(1, stableCountRef.current > 0 ? Math.min(p, totalPages) : p);
    setQuery((prev) => ({ ...prev, page: clamped }));
  }

  function handlePageSizeChange(size: number) {
    setQuery((prev) => ({ ...prev, pageSize: size, page: 1 }));
  }

  async function handleExport() {
    if (count === 0) return;
    setExporting(true);
    setExportError("");
    try {
      const term = query.term;
      const allRows: Row[] = [];
      let offset = 0;
      let iterations = 0;
      // Safety cap — do not rely only on `count` (can be stale); stop on empty/partial chunk.
      const maxIterations = Math.max(
        5000,
        Math.ceil(count / EXPORT_CHUNK_SIZE) + 100
      );

      while (iterations < maxIterations) {
        iterations += 1;
        const res = await fetch(
          `/api/projects?limit=${EXPORT_CHUNK_SIZE}&offset=${offset}&input=${encodeURIComponent(term)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Export failed (HTTP ${res.status})`);
        }
        const json = await res.json();
        const { data: chunk } = parseProjectsResponse(json);
        if (chunk.length === 0) break;
        allRows.push(...chunk);
        offset += chunk.length;
        if (chunk.length < EXPORT_CHUNK_SIZE) break;
      }

      if (allRows.length === 0) {
        throw new Error("No rows returned for export.");
      }
      const csv = convertToCSV(allRows);
      triggerDownload(csv, "all-projects-complete-mosaic.csv");
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Please try again."
      );
    } finally {
      setExporting(false);
    }
  }

  const skeletonRows = Array.from({ length: query.pageSize }, (_, i) => i);
  const rowOffset = (query.page - 1) * query.pageSize;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Stats / toolbar bar — sticky top ────────────────────────────────── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-[#5c0000] px-5 py-3">
        {/* Left: record count */}
        <span className="text-2xl font-bold text-white">
          {loading ? (
            <span className="opacity-70">Loading…</span>
          ) : (
            <>
              <span className="font-bold">Project Count: </span>
              {count.toLocaleString()}
            </>
          )}
        </span>

        {/* Right: Download + Search */}
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          {exportError && (
            <span className="max-w-[220px] text-right text-xs text-amber-200 sm:max-w-xs">
              {exportError}
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={exporting || loading || count === 0}
            className="flex items-center gap-2 rounded-md bg-[#8b0000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 011 1v9.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V3a1 1 0 011-1z" />
                <path d="M3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            )}
            {exporting ? "Exporting…" : "Download as CSV"}
          </button>

          {/* Search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3a6 6 0 100 12A6 6 0 009 3zM1 9a8 8 0 1114.32 4.906l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387A8 8 0 011 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-40 rounded-md border-0 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-white/50 sm:w-52"
            />
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L1 14h14L8 1zm0 3l4.5 8h-9L8 4zm-.75 3v2.5h1.5V7h-1.5zm0 3.5v1.5h1.5v-1.5h-1.5z" />
          </svg>
          {fetchError}
        </div>
      )}

      {/* ── Table — fills middle, scrolls both axes ─────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="w-12 border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-600">
                #
              </th>
              {columnKeys.map((key) => (
                <th
                  key={key}
                  className="min-w-[7rem] max-w-[16rem] whitespace-nowrap border-b border-gray-200 px-3 py-3 text-center text-xs font-semibold text-gray-600"
                  title={key}
                >
                  {headerLabelForKey(key)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              skeletonRows.map((i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3">
                    <div className="mx-auto h-3.5 w-6 animate-pulse rounded bg-gray-200" />
                  </td>
                  {Array.from({ length: skeletonColCount }, (_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div
                        className="mx-auto h-3.5 animate-pulse rounded bg-gray-200"
                        style={{
                          width: SKELETON_W[(i + j) % SKELETON_W.length],
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columnKeys.length, 1) + 1}
                  className="py-20 text-center text-sm text-gray-400"
                >
                  {query.page > 1 && count > 0 ? (
                    <>
                      <svg
                        className="mx-auto mb-3 h-8 w-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 10h18M3 14h18M10 3v18M14 3v18"
                        />
                      </svg>
                      <p className="mb-3 font-medium text-gray-500">
                        No data on page {query.page}
                      </p>
                      <button
                        onClick={() => handlePageChange(query.page - 1)}
                        className="rounded-md bg-[#8b0000] px-4 py-2 text-xs font-semibold text-white hover:bg-[#a00000] cursor-pointer"
                      >
                        ← Go to page {query.page - 1}
                      </button>
                    </>
                  ) : (
                    <>
                      <svg
                        className="mx-auto mb-3 h-8 w-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      No results found
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className={
                    (i % 2 === 0 ? "bg-white" : "bg-gray-50") +
                    " transition-colors hover:bg-gray-100"
                  }
                >
                  {/* Row number */}
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {rowOffset + i + 1}
                  </td>
                  {columnKeys.map((key) => (
                    <td
                      key={key}
                      className="max-w-[16rem] truncate px-3 py-3 text-center text-gray-700"
                      title={stringifyField(row[key]) || undefined}
                    >
                      {cellDisplay(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination — sticky bottom ───────────────────────────────────────── */}
      <PaginationBar
        page={query.page}
        totalPages={totalPages}
        pageSize={query.pageSize}
        count={count}
        loading={loading}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}

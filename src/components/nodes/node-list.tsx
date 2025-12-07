"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { NodeTable } from "./node-table";
import { formatNumber } from "@/lib/utils/format";

const ITEMS_PER_PAGE = 25;

type StatusFilter = "all" | "active" | "inactive";
type SortColumn = "lastSeen" | "firstSeen" | "address" | "version" | "isActive";
type SortOrder = "asc" | "desc";

export function NodeList() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [version, setVersion] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortColumn>("lastSeen");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: versionsData } = trpc.nodes.versions.useQuery();

  const { data, isLoading, refetch, isFetching } = trpc.nodes.listWithMetrics.useQuery(
    {
      status,
      version: version || undefined,
      search: search || undefined,
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      orderBy: sortBy,
      order: sortOrder,
    },
    {
      refetchInterval: 30000,
    }
  );

  const handleSort = useCallback((column: string) => {
    // Map UI column names to API field names
    const columnMap: Record<string, SortColumn> = {
      isActive: "isActive",
      address: "address",
      version: "version",
      lastSeen: "lastSeen",
    };

    const apiColumn = columnMap[column];
    if (!apiColumn) return;

    if (sortBy === apiColumn) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(apiColumn);
      setSortOrder("desc");
    }
    setPage(1);
  }, [sortBy]);

  const handleStatusChange = (value: string) => {
    setStatus(value as StatusFilter);
    setPage(1);
  };

  const handleVersionChange = (value: string) => {
    setVersion(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;

  // Build version options
  const versionOptions = [
    { value: "", label: "All Versions" },
    ...(versionsData?.map((v) => ({
      value: v.version,
      label: `${v.version} (${v.count})`,
    })) || []),
  ];

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by IP or pubkey..."
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={status}
            onChange={handleStatusChange}
            options={statusOptions}
          />
          <Select
            value={version}
            onChange={handleVersionChange}
            options={versionOptions}
          />
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {data && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{formatNumber(data.total)}</span> nodes found
          </span>
          {(status !== "all" || version || search) && (
            <button
              onClick={() => {
                setStatus("all");
                setVersion("");
                setSearch("");
                setPage(1);
              }}
              className="text-brand-500 hover:text-brand-600"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <NodeTable
        nodes={data?.nodes || []}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {data && data.total > ITEMS_PER_PAGE && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={data.total}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  );
}

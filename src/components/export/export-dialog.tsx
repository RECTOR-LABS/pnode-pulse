"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";
import { logger } from "@/lib/logger";

type ExportType = "current" | "historical" | "alerts";
type Aggregation = "raw" | "hourly" | "daily";

const COLUMNS = [
  { id: "timestamp", label: "Timestamp" },
  { id: "node_address", label: "Node Address" },
  { id: "cpu_percent", label: "CPU %" },
  { id: "ram_percent", label: "RAM %" },
  { id: "storage_gb", label: "Storage (GB)" },
  { id: "uptime_hours", label: "Uptime (hours)" },
  { id: "packets_received", label: "Packets Received" },
  { id: "packets_sent", label: "Packets Sent" },
  { id: "version", label: "Version" },
  { id: "is_active", label: "Status" },
] as const;

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const sessionId = useSession();
  const [exportType, setExportType] = useState<ExportType>("current");
  const [nodeSelection, setNodeSelection] = useState<"all" | "portfolio">("all");
  const [aggregation, setAggregation] = useState<Aggregation>("hourly");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "timestamp",
    "node_address",
    "cpu_percent",
    "ram_percent",
    "storage_gb",
    "uptime_hours",
  ]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: preview, isLoading: previewLoading } = trpc.export.preview.useQuery(
    {
      type: exportType,
      portfolioSessionId: nodeSelection === "portfolio" ? sessionId : undefined,
      dateRange: exportType === "historical" ? { from: dateFrom, to: dateTo } : undefined,
      aggregation,
      columns: selectedColumns as Array<typeof COLUMNS[number]["id"]>,
      limit: 5,
    },
    { enabled: isOpen }
  );

  const generateCsv = trpc.export.generateCsv.useMutation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await generateCsv.mutateAsync({
        type: exportType,
        portfolioSessionId: nodeSelection === "portfolio" ? sessionId : undefined,
        dateRange: exportType === "historical" ? { from: dateFrom, to: dateTo } : undefined,
        aggregation,
        columns: selectedColumns as Array<typeof COLUMNS[number]["id"]>,
      });

      // Create and download file
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      logger.error("Export failed", error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Export Data</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Data Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Data Type</label>
            <div className="flex gap-2">
              {[
                { id: "current", label: "Current Stats" },
                { id: "historical", label: "Historical Metrics" },
                { id: "alerts", label: "Alert History" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setExportType(opt.id as ExportType)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    exportType === opt.id
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Node Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Nodes</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNodeSelection("all")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  nodeSelection === "all"
                    ? "bg-brand-500 text-white border-brand-500"
                    : "border-border hover:bg-muted"
                }`}
              >
                All Nodes
              </button>
              <button
                onClick={() => setNodeSelection("portfolio")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  nodeSelection === "portfolio"
                    ? "bg-brand-500 text-white border-brand-500"
                    : "border-border hover:bg-muted"
                }`}
              >
                My Portfolio
              </button>
            </div>
          </div>

          {/* Date Range (for historical) */}
          {exportType === "historical" && (
            <div>
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Aggregation (for historical) */}
          {exportType === "historical" && (
            <div>
              <label className="block text-sm font-medium mb-2">Aggregation</label>
              <div className="flex gap-2">
                {[
                  { id: "raw", label: "Raw (every 30s)" },
                  { id: "hourly", label: "Hourly Averages" },
                  { id: "daily", label: "Daily Averages" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAggregation(opt.id as Aggregation)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      aggregation === opt.id
                        ? "bg-brand-500 text-white border-brand-500"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Column Selection */}
          {exportType !== "alerts" && (
            <div>
              <label className="block text-sm font-medium mb-2">Columns</label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      selectedColumns.includes(col.id)
                        ? "bg-brand-500/20 border-brand-500 text-brand-600 dark:text-brand-400"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Preview</label>
              {preview && (
                <span className="text-xs text-muted-foreground">
                  {preview.totalRows.toLocaleString()} total rows
                </span>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg overflow-x-auto">
              {previewLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading preview...
                </div>
              ) : preview && preview.preview.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      {Object.keys(preview.preview[0]).slice(0, 6).map((key) => (
                        <th key={key} className="px-2 py-1 text-left font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.values(row).slice(0, 6).map((val, j) => (
                          <td key={j} className="px-2 py-1 truncate max-w-[150px]">
                            {val === null ? "-" : typeof val === "number" ? val.toFixed(2) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No data to preview
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !preview?.totalRows}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

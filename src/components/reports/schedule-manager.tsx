"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/hooks/use-session";
import type { ReportType, ReportSchedule, ReportScope, DeliveryStatus } from "@prisma/client";

interface Timezone {
  value: string;
  label: string;
}

interface ReportDelivery {
  id: string;
  status: DeliveryStatus;
  scheduledFor: Date;
  sentAt: Date | null;
  error: string | null;
}

interface ScheduledReport {
  id: string;
  name: string;
  reportType: ReportType;
  schedule: ReportSchedule;
  timezone: string;
  sendHour: number;
  sendDayOfWeek: number | null;
  sendDayOfMonth: number | null;
  recipients: string[];
  scope: ReportScope;
  portfolio: { id: string; name: string } | null;
  isEnabled: boolean;
  lastSentAt: Date | null;
  nextSendAt: Date | null;
  recentDeliveries: ReportDelivery[];
  createdAt: Date;
}

interface CreateReportForm {
  name: string;
  reportType: ReportType;
  schedule: ReportSchedule;
  sendHour: number;
  sendDayOfWeek?: number;
  sendDayOfMonth?: number;
  recipients: string;
  scope: ReportScope;
  timezone: string;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "DAILY_DIGEST", label: "Daily Digest", description: "Quick daily overview of network health" },
  { value: "WEEKLY_SUMMARY", label: "Weekly Summary", description: "Detailed weekly performance report" },
  { value: "MONTHLY_SLA", label: "Monthly SLA", description: "Monthly availability and SLA metrics" },
  { value: "CUSTOM", label: "Custom", description: "Custom report with all metrics" },
];

const SCHEDULE_OPTIONS: { value: ReportSchedule; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function ScheduleManager() {
  const sessionId = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const [_editingId, _setEditingId] = useState<string | null>(null);

  const { data: reports, refetch } = trpc.reports.list.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  const { data: timezones } = trpc.reports.timezones.useQuery();

  const createMutation = trpc.reports.create.useMutation({
    onSuccess: () => {
      setShowCreate(false);
      refetch();
    },
  });

  const deleteMutation = trpc.reports.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const toggleMutation = trpc.reports.toggle.useMutation({
    onSuccess: () => refetch(),
  });

  const sendNowMutation = trpc.reports.sendNow.useMutation({
    onSuccess: () => refetch(),
  });

  const [form, setForm] = useState<CreateReportForm>({
    name: "",
    reportType: "WEEKLY_SUMMARY",
    schedule: "WEEKLY",
    sendHour: 9,
    sendDayOfWeek: 1,
    sendDayOfMonth: 1,
    recipients: "",
    scope: "PORTFOLIO",
    timezone: "UTC",
  });

  const handleCreate = () => {
    if (!sessionId) return;

    const recipientList = form.recipients
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (recipientList.length === 0) {
      alert("Please enter at least one valid email address");
      return;
    }

    createMutation.mutate({
      sessionId,
      name: form.name,
      reportType: form.reportType,
      schedule: form.schedule,
      sendHour: form.sendHour,
      sendDayOfWeek: form.schedule === "WEEKLY" ? form.sendDayOfWeek : undefined,
      sendDayOfMonth: form.schedule === "MONTHLY" ? form.sendDayOfMonth : undefined,
      recipients: recipientList,
      scope: form.scope,
      timezone: form.timezone,
    });
  };

  const formatNextSend = (date: Date | null) => {
    if (!date) return "Not scheduled";
    return new Date(date).toLocaleString();
  };

  const formatSchedule = (report: ScheduledReport) => {
    switch (report.schedule) {
      case "DAILY":
        return `Daily at ${report.sendHour}:00`;
      case "WEEKLY":
        return `Weekly on ${DAYS_OF_WEEK[report.sendDayOfWeek || 0]?.label} at ${report.sendHour}:00`;
      case "MONTHLY":
        return `Monthly on day ${report.sendDayOfMonth || 1} at ${report.sendHour}:00`;
      default:
        return report.schedule;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scheduled Reports</h2>
          <p className="text-sm text-muted-foreground">
            Configure automated email reports for your nodes
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Report
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Create Scheduled Report</h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Report Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Weekly Report"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Report Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setForm({ ...form, reportType: type.value })}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        form.reportType === type.value
                          ? "border-brand-500 bg-brand-500/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <select
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value as ReportSchedule })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day of Week (for weekly) */}
              {form.schedule === "WEEKLY" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Day of Week</label>
                  <select
                    value={form.sendDayOfWeek}
                    onChange={(e) => setForm({ ...form, sendDayOfWeek: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {form.schedule === "MONTHLY" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Day of Month</label>
                  <select
                    value={form.sendDayOfMonth}
                    onChange={(e) => setForm({ ...form, sendDayOfMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time and Timezone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Send Time</label>
                  <select
                    value={form.sendHour}
                    onChange={(e) => setForm({ ...form, sendHour: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {(timezones || []).map((tz: Timezone) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium mb-1">Scope</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.scope === "PORTFOLIO"}
                      onChange={() => setForm({ ...form, scope: "PORTFOLIO" })}
                      className="text-brand-500"
                    />
                    <span className="text-sm">Portfolio Nodes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.scope === "ALL_NODES"}
                      onChange={() => setForm({ ...form, scope: "ALL_NODES" })}
                      className="text-brand-500"
                    />
                    <span className="text-sm">All Network Nodes</span>
                  </label>
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium mb-1">Recipients</label>
                <textarea
                  value={form.recipients}
                  onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separate multiple emails with commas
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name || !form.recipients || createMutation.isPending}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {!reports || reports.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <svg
              className="w-12 h-12 mx-auto text-muted-foreground mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-muted-foreground">No scheduled reports yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-brand-500 hover:text-brand-600"
            >
              Create your first report
            </button>
          </div>
        ) : (
          (reports as ScheduledReport[]).map((report) => (
            <div
              key={report.id}
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{report.name}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        report.isEnabled
                          ? "bg-status-active/10 text-status-active"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {report.isEnabled ? "Active" : "Paused"}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-muted rounded-full">
                      {report.reportType.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatSchedule(report)} ({report.timezone})
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Recipients: {(report.recipients || []).join(", ")}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (sessionId) {
                        sendNowMutation.mutate({ id: report.id, sessionId });
                      }
                    }}
                    disabled={sendNowMutation.isPending}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Send Now"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (sessionId) {
                        toggleMutation.mutate({ id: report.id, sessionId });
                      }
                    }}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title={report.isEnabled ? "Pause" : "Resume"}
                  >
                    {report.isEnabled ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (sessionId && confirm("Delete this scheduled report?")) {
                        deleteMutation.mutate({ id: report.id, sessionId });
                      }
                    }}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Next Send & Recent Deliveries */}
              <div className="px-4 py-3 bg-muted/30 border-t border-border text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Next send: <span className="text-foreground">{formatNextSend(report.nextSendAt)}</span>
                  </span>
                  {report.lastSentAt && (
                    <span className="text-muted-foreground">
                      Last sent: {new Date(report.lastSentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {report.recentDeliveries && report.recentDeliveries.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Recent:</span>
                    {report.recentDeliveries.slice(0, 5).map((d: ReportDelivery) => (
                      <span
                        key={d.id}
                        className={`w-2 h-2 rounded-full ${
                          d.status === "SENT"
                            ? "bg-status-active"
                            : d.status === "FAILED"
                            ? "bg-status-error"
                            : "bg-status-warning"
                        }`}
                        title={`${d.status} - ${new Date(d.scheduledFor).toLocaleString()}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

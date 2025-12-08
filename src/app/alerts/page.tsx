"use client";

import { useState } from "react";
import { RuleBuilder, RuleList, AlertHistory, ChannelManager, EscalationManager } from "@/components/alerts";
import type { AlertMetric, AlertOperator, AlertTargetType } from "@/lib/notifications/types";

type Tab = "rules" | "history" | "channels" | "escalation";

interface EditRule {
  id: string;
  name: string;
  description?: string | null;
  targetType: AlertTargetType;
  nodeIds: number[];
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  cooldown: number;
  channels: string[];
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("rules");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<EditRule | undefined>();

  const handleCreateNew = () => {
    setEditingRule(undefined);
    setShowBuilder(true);
  };

  const handleEdit = (rule: {
    id: string;
    name: string;
    description: string | null;
    targetType: string;
    nodeIds: number[];
    metric: AlertMetric;
    operator: AlertOperator;
    threshold: number;
    cooldown: number;
    channels: string[];
  }) => {
    setEditingRule({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      targetType: rule.targetType as AlertTargetType,
      nodeIds: rule.nodeIds,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      cooldown: rule.cooldown,
      channels: rule.channels,
    });
    setShowBuilder(true);
  };

  const handleBuilderSuccess = () => {
    setShowBuilder(false);
    setEditingRule(undefined);
  };

  const handleBuilderCancel = () => {
    setShowBuilder(false);
    setEditingRule(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Alert Management</h1>
            <p className="text-muted-foreground">
              Configure rules and receive notifications for your nodes
            </p>
          </div>

          {activeTab === "rules" && !showBuilder && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Rule
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
          {([
            { id: "rules", label: "Alert Rules", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
            { id: "history", label: "Alert History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
            { id: "channels", label: "Channels", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
            { id: "escalation", label: "Escalation", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setShowBuilder(false);
                setEditingRule(undefined);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-card border border-border rounded-lg p-6">
          {activeTab === "rules" && (
            showBuilder ? (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={handleBuilderCancel}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <h2 className="text-lg font-medium">
                    {editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
                  </h2>
                </div>
                <RuleBuilder
                  editRule={editingRule}
                  onSuccess={handleBuilderSuccess}
                  onCancel={handleBuilderCancel}
                />
              </div>
            ) : (
              <RuleList onEdit={handleEdit} />
            )
          )}

          {activeTab === "history" && <AlertHistory />}

          {activeTab === "channels" && <ChannelManager />}

          {activeTab === "escalation" && <EscalationManager />}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <QuickStat
            label="Active Rules"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
          />
          <QuickStat
            label="Alerts Today"
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
          <QuickStat
            label="Channels"
            icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-bold">--</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

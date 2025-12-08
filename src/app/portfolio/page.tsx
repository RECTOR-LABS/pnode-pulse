"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";
import {
  PortfolioSummary,
  PortfolioNodeCard,
  AddNodeDialog,
  BenchmarkTable,
  SlaReport,
} from "@/components/portfolio";
import {
  VersionStatus,
  UnderperformersCard,
  RecommendationsPanel,
  NodeComparison,
} from "@/components/comparison";

type Tab = "nodes" | "benchmark" | "sla" | "insights" | "compare";

export default function PortfolioPage() {
  const sessionId = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("nodes");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: portfolio, refetch, isLoading } = trpc.portfolio.get.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const handleRefetch = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">My Portfolio</h1>
            <p className="text-muted-foreground">
              Manage and monitor your pNode fleet
            </p>
          </div>

          <button
            onClick={() => setShowAddDialog(true)}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Node
          </button>
        </div>

        {/* Summary Stats */}
        <div className="mb-8">
          <PortfolioSummary />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit overflow-x-auto">
          {([
            { id: "nodes", label: "My Nodes", icon: "M5 12h14M12 5l7 7-7 7" },
            { id: "benchmark", label: "Benchmark", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { id: "sla", label: "SLA Report", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
            { id: "insights", label: "Insights", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
            { id: "compare", label: "Compare", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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
        <div>
          {activeTab === "nodes" && (
            <div>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-muted rounded-full" />
                        <div className="h-5 bg-muted rounded w-32" />
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                        {[...Array(4)].map((_, j) => (
                          <div key={j} className="h-10 bg-muted rounded" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !portfolio?.nodes.length ? (
                <div className="bg-card border border-border rounded-lg p-12 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <h3 className="text-lg font-medium mb-2">No nodes in your portfolio</h3>
                  <p className="text-muted-foreground mb-6">
                    Add nodes to track their performance and manage them in one place.
                  </p>
                  <button
                    onClick={() => setShowAddDialog(true)}
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Your First Node
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {portfolio.nodes.map((pn) => (
                    <PortfolioNodeCard
                      key={pn.id}
                      portfolioNode={pn}
                      onUpdate={handleRefetch}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "benchmark" && <BenchmarkTable />}

          {activeTab === "sla" && <SlaReport />}

          {activeTab === "insights" && (
            <div className="space-y-6">
              {/* Version Status & Underperformers side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VersionStatus mode="portfolio" />
                <UnderperformersCard />
              </div>

              {/* Recommendations */}
              <RecommendationsPanel />
            </div>
          )}

          {activeTab === "compare" && <NodeComparison />}
        </div>

        {/* Add Node Dialog */}
        <AddNodeDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleRefetch}
        />
      </div>
    </div>
  );
}

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const metadata = {
  title: "Analytics - pNode Pulse",
  description: "Network analytics, growth forecasts, and performance insights",
};

export default function AnalyticsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Network Analytics</h1>
        <p className="text-muted-foreground">
          Growth forecasts, degradation predictions, and peer optimization insights
        </p>
      </div>

      <AnalyticsDashboard />
    </main>
  );
}

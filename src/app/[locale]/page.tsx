import { NetworkOverview } from "@/components/dashboard/network-overview";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Network Overview</h1>
        <p className="text-muted-foreground">
          Real-time status and metrics from Xandeum&apos;s pNode network
        </p>
      </div>

      {/* Dashboard */}
      <NetworkOverview />
    </main>
  );
}

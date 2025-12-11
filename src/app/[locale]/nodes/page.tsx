import { NodeList } from "@/components/nodes/node-list";

export const metadata = {
  title: "Network Nodes - pNode Pulse",
  description: "Browse all pNodes in the Xandeum network with filtering and sorting",
};

export default function NodesPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Network Nodes</h1>
        <p className="text-muted-foreground">
          Browse and filter all pNodes in the Xandeum network
        </p>
      </div>

      <NodeList />
    </main>
  );
}

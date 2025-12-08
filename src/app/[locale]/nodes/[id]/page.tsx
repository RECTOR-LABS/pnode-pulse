import Link from "next/link";
import { NodeDetail } from "@/components/nodes/node-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Node ${id} - pNode Pulse`,
    description: `Detailed metrics and information for pNode ${id}`,
  };
}

export default async function NodeDetailPage({ params }: Props) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);

  // Handle invalid ID
  if (isNaN(nodeId)) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/nodes"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Nodes
        </Link>

        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-status-inactive/10 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-status-inactive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Invalid Node ID</h2>
          <p className="text-muted-foreground">
            The provided node ID &quot;{id}&quot; is not valid.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/nodes"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Nodes
      </Link>

      <NodeDetail nodeId={nodeId} />
    </main>
  );
}

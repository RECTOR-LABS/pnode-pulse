import { NetworkMap } from "@/components/dashboard/network-map";

export const metadata = {
  title: "Network Map - pNode Pulse",
  description: "Interactive visualization of the pNode network topology",
};

export default function NetworkMapPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Network Map</h1>
        <p className="text-muted-foreground">
          Interactive visualization of pNode connections and topology
        </p>
      </div>

      <div className="card p-6">
        <NetworkMap />
      </div>
    </main>
  );
}

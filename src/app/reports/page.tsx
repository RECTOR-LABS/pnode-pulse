import { ScheduleManager } from "@/components/reports";

export const metadata = {
  title: "Scheduled Reports | pNode Pulse",
  description: "Configure and manage automated email reports for your pNode network",
};

export default function ReportsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ScheduleManager />
    </div>
  );
}

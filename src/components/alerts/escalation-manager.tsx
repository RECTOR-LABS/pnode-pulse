"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

interface EscalationStep {
  delayMinutes: number;
  channels: string[];
  repeatIntervalMinutes?: number;
}

interface EditingPolicy {
  id?: string;
  name: string;
  description: string;
  steps: EscalationStep[];
}


export function EscalationManager() {
  const sessionId = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EditingPolicy | null>(null);

  const { data: policies, refetch } = trpc.alerts.escalationPolicies.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const { data: channels } = trpc.alerts.channels.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const createMutation = trpc.alerts.createEscalationPolicy.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      setEditingPolicy(null);
    },
  });

  const updateMutation = trpc.alerts.updateEscalationPolicy.useMutation({
    onSuccess: () => {
      refetch();
      setEditingPolicy(null);
    },
  });

  const deleteMutation = trpc.alerts.deleteEscalationPolicy.useMutation({
    onSuccess: () => refetch(),
  });

  const handleStartCreate = () => {
    setEditingPolicy({
      name: "",
      description: "",
      steps: [{ delayMinutes: 5, channels: [] }],
    });
    setIsCreating(true);
  };

  const handleEdit = (policy: NonNullable<typeof policies>[number]) => {
    setEditingPolicy({
      id: policy.id,
      name: policy.name,
      description: policy.description || "",
      steps: policy.steps.map((s) => ({
        delayMinutes: s.delayMinutes,
        channels: s.channels as string[],
        repeatIntervalMinutes: s.repeatIntervalMinutes || undefined,
      })),
    });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingPolicy || !sessionId) return;

    if (editingPolicy.steps.length === 0) {
      alert("At least one escalation step is required");
      return;
    }

    for (const step of editingPolicy.steps) {
      if (step.channels.length === 0) {
        alert("Each step must have at least one channel");
        return;
      }
    }

    if (editingPolicy.id) {
      await updateMutation.mutateAsync({
        id: editingPolicy.id,
        sessionId,
        name: editingPolicy.name,
        description: editingPolicy.description || undefined,
        steps: editingPolicy.steps,
      });
    } else {
      await createMutation.mutateAsync({
        sessionId,
        name: editingPolicy.name,
        description: editingPolicy.description || undefined,
        steps: editingPolicy.steps,
      });
    }
  };

  const handleAddStep = () => {
    if (!editingPolicy) return;
    const lastStep = editingPolicy.steps[editingPolicy.steps.length - 1];
    const newDelay = lastStep ? lastStep.delayMinutes + 10 : 5;
    setEditingPolicy({
      ...editingPolicy,
      steps: [...editingPolicy.steps, { delayMinutes: newDelay, channels: [] }],
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editingPolicy) return;
    setEditingPolicy({
      ...editingPolicy,
      steps: editingPolicy.steps.filter((_, i) => i !== index),
    });
  };

  const handleStepChange = (index: number, updates: Partial<EscalationStep>) => {
    if (!editingPolicy) return;
    setEditingPolicy({
      ...editingPolicy,
      steps: editingPolicy.steps.map((step, i) =>
        i === index ? { ...step, ...updates } : step
      ),
    });
  };

  if (!sessionId) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  // Editing/Creating Form
  if (editingPolicy) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {isCreating ? "Create Escalation Policy" : "Edit Escalation Policy"}
          </h3>
          <button
            onClick={() => {
              setEditingPolicy(null);
              setIsCreating(false);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Policy Name</label>
            <input
              type="text"
              value={editingPolicy.name}
              onChange={(e) => setEditingPolicy({ ...editingPolicy, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
              placeholder="e.g., Critical Alert Escalation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editingPolicy.description}
              onChange={(e) => setEditingPolicy({ ...editingPolicy, description: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg resize-none"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">Escalation Steps</label>
              <button
                onClick={handleAddStep}
                className="text-sm text-brand-500 hover:text-brand-600"
              >
                + Add Step
              </button>
            </div>

            <div className="space-y-4">
              {editingPolicy.steps.map((step, index) => (
                <div
                  key={index}
                  className="p-4 bg-muted/50 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Step {index + 1}</span>
                    {editingPolicy.steps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(index)}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Delay (minutes after alert)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={step.delayMinutes}
                        onChange={(e) =>
                          handleStepChange(index, { delayMinutes: parseInt(e.target.value) || 1 })
                        }
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Repeat Every (minutes, optional)
                      </label>
                      <input
                        type="number"
                        min={5}
                        value={step.repeatIntervalMinutes || ""}
                        onChange={(e) =>
                          handleStepChange(index, {
                            repeatIntervalMinutes: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        placeholder="No repeat"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-muted-foreground mb-1">
                      Notification Channels
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {channels?.map((channel) => (
                        <label
                          key={channel.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                            step.channels.includes(channel.id)
                              ? "bg-brand-500/10 border-brand-500 text-brand-500"
                              : "bg-background border-border hover:border-brand-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={step.channels.includes(channel.id)}
                            onChange={(e) => {
                              const newChannels = e.target.checked
                                ? [...step.channels, channel.id]
                                : step.channels.filter((c) => c !== channel.id);
                              handleStepChange(index, { channels: newChannels });
                            }}
                            className="hidden"
                          />
                          <span className="text-xs">
                            {channel.type === "EMAIL" ? "Email" : channel.type === "DISCORD" ? "Discord" : "Telegram"}
                          </span>
                          <span className="text-xs text-muted-foreground">{channel.name}</span>
                        </label>
                      ))}
                      {(!channels || channels.length === 0) && (
                        <p className="text-xs text-muted-foreground">
                          No channels configured. Add channels first.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={() => {
              setEditingPolicy(null);
              setIsCreating(false);
            }}
            className="px-4 py-2 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!editingPolicy.name || createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving..."
              : isCreating
              ? "Create Policy"
              : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  // Policy List
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Escalation Policies</h3>
          <p className="text-sm text-muted-foreground">
            Define multi-step escalation for unacknowledged alerts
          </p>
        </div>
        <button
          onClick={handleStartCreate}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Policy
        </button>
      </div>

      {!policies || policies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p>No escalation policies configured</p>
          <p className="text-sm">Create a policy to escalate unacknowledged alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{policy.name}</h4>
                    <span className="px-2 py-0.5 text-xs bg-muted rounded-full">
                      {policy.steps.length} step{policy.steps.length !== 1 ? "s" : ""}
                    </span>
                    {policy._count.rules > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-brand-500/10 text-brand-500 rounded-full">
                        {policy._count.rules} rule{policy._count.rules !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    {policy.steps.map((step, idx) => (
                      <span key={step.id} className="flex items-center gap-1">
                        <span className="w-5 h-5 flex items-center justify-center bg-muted rounded-full text-xs">
                          {idx + 1}
                        </span>
                        {step.delayMinutes}m
                        {step.repeatIntervalMinutes && ` (repeat: ${step.repeatIntervalMinutes}m)`}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(policy)}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this escalation policy?")) {
                        deleteMutation.mutate({ id: policy.id, sessionId });
                      }
                    }}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { InlineField, Input, Select } from "@grafana/ui";
import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { PnodePulseDataSource } from "../datasource/datasource";
import {
  PnodePulseDataSourceOptions,
  PnodePulseQuery,
  QueryType,
  defaultQuery,
} from "../datasource/types";

type Props = QueryEditorProps<
  PnodePulseDataSource,
  PnodePulseQuery,
  PnodePulseDataSourceOptions
>;

const queryTypeOptions: Array<SelectableValue<QueryType>> = [
  { label: "Network Overview", value: QueryType.Network, description: "Aggregate network statistics" },
  { label: "Nodes List", value: QueryType.Nodes, description: "List of all nodes" },
  { label: "Node Metrics", value: QueryType.Node, description: "Historical metrics for a specific node" },
  { label: "Leaderboard", value: QueryType.Leaderboard, description: "Top performing nodes" },
];

const statusOptions: Array<SelectableValue<string>> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const metricOptions: Array<SelectableValue<string>> = [
  { label: "Uptime", value: "uptime" },
  { label: "CPU", value: "cpu" },
  { label: "RAM", value: "ram" },
  { label: "Storage", value: "storage" },
];

const aggregationOptions: Array<SelectableValue<string>> = [
  { label: "Raw", value: "raw" },
  { label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
];

const timeRangeOptions: Array<SelectableValue<string>> = [
  { label: "1 Hour", value: "1h" },
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
];

/**
 * Query editor for pNode Pulse datasource
 */
export function QueryEditor(props: Props) {
  const { query, onChange, onRunQuery } = props;

  const onQueryTypeChange = (value: SelectableValue<QueryType>) => {
    onChange({ ...query, queryType: value.value! });
    onRunQuery();
  };

  const onNodeIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange({
      ...query,
      nodeId: value ? parseInt(value, 10) : undefined,
    });
  };

  const onNodeAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, nodeAddress: event.target.value });
  };

  const onStatusChange = (value: SelectableValue<string>) => {
    onChange({ ...query, status: value.value as "all" | "active" | "inactive" });
    onRunQuery();
  };

  const onMetricChange = (value: SelectableValue<string>) => {
    onChange({ ...query, metric: value.value as "cpu" | "ram" | "storage" | "uptime" });
    onRunQuery();
  };

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange({ ...query, limit: value ? parseInt(value, 10) : undefined });
  };

  const onAggregationChange = (value: SelectableValue<string>) => {
    onChange({ ...query, aggregation: value.value as "raw" | "hourly" | "daily" });
    onRunQuery();
  };

  const onTimeRangeChange = (value: SelectableValue<string>) => {
    onChange({ ...query, timeRange: value.value as "1h" | "24h" | "7d" | "30d" });
    onRunQuery();
  };

  // Apply defaults
  const currentQuery = { ...defaultQuery, ...query };

  return (
    <div className="gf-form-group">
      {/* Query Type */}
      <InlineField label="Query Type" labelWidth={14}>
        <Select
          options={queryTypeOptions}
          value={currentQuery.queryType}
          onChange={onQueryTypeChange}
          width={25}
        />
      </InlineField>

      {/* Nodes List Options */}
      {currentQuery.queryType === QueryType.Nodes && (
        <>
          <InlineField label="Status" labelWidth={14}>
            <Select
              options={statusOptions}
              value={currentQuery.status}
              onChange={onStatusChange}
              width={15}
            />
          </InlineField>
          <InlineField label="Limit" labelWidth={14}>
            <Input
              type="number"
              value={currentQuery.limit || 50}
              onChange={onLimitChange}
              onBlur={onRunQuery}
              width={10}
            />
          </InlineField>
        </>
      )}

      {/* Node Metrics Options */}
      {currentQuery.queryType === QueryType.Node && (
        <>
          <InlineField label="Node ID" labelWidth={14}>
            <Input
              type="number"
              value={currentQuery.nodeId || ""}
              onChange={onNodeIdChange}
              onBlur={onRunQuery}
              placeholder="1"
              width={10}
            />
          </InlineField>
          <InlineField label="Or Address" labelWidth={14}>
            <Input
              value={currentQuery.nodeAddress || ""}
              onChange={onNodeAddressChange}
              onBlur={onRunQuery}
              placeholder="192.168.1.1:9001"
              width={20}
            />
          </InlineField>
          <InlineField label="Metric" labelWidth={14}>
            <Select
              options={metricOptions}
              value={currentQuery.metric}
              onChange={onMetricChange}
              width={15}
            />
          </InlineField>
          <InlineField label="Time Range" labelWidth={14}>
            <Select
              options={timeRangeOptions}
              value={currentQuery.timeRange}
              onChange={onTimeRangeChange}
              width={15}
            />
          </InlineField>
          <InlineField label="Aggregation" labelWidth={14}>
            <Select
              options={aggregationOptions}
              value={currentQuery.aggregation}
              onChange={onAggregationChange}
              width={15}
            />
          </InlineField>
        </>
      )}

      {/* Leaderboard Options */}
      {currentQuery.queryType === QueryType.Leaderboard && (
        <>
          <InlineField label="Metric" labelWidth={14}>
            <Select
              options={metricOptions}
              value={currentQuery.metric}
              onChange={onMetricChange}
              width={15}
            />
          </InlineField>
          <InlineField label="Limit" labelWidth={14}>
            <Input
              type="number"
              value={currentQuery.limit || 10}
              onChange={onLimitChange}
              onBlur={onRunQuery}
              width={10}
            />
          </InlineField>
        </>
      )}
    </div>
  );
}

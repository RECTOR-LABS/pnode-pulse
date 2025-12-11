import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryError,
  MutableDataFrame,
  FieldType,
  dateTime,
} from "@grafana/data";
import { getBackendSrv, getTemplateSrv } from "@grafana/runtime";
import { lastValueFrom } from "rxjs";
import {
  PnodePulseQuery,
  PnodePulseDataSourceOptions,
  QueryType,
  NetworkOverview,
  Node,
  NodeMetrics,
  Leaderboard,
} from "./types";

export class PnodePulseDataSource extends DataSourceApi<
  PnodePulseQuery,
  PnodePulseDataSourceOptions
> {
  url: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PnodePulseDataSourceOptions>
  ) {
    super(instanceSettings);
    this.url = instanceSettings.url || "https://pulse.rectorspace.com";
  }

  /**
   * Main query handler - routes to specific query types
   */
  async query(
    options: DataQueryRequest<PnodePulseQuery>
  ): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range?.from.valueOf() ?? Date.now() - 86400000;
    const to = range?.to.valueOf() ?? Date.now();

    const promises = options.targets
      .filter((target) => !target.hide)
      .map(async (target) => {
        try {
          switch (target.queryType) {
            case QueryType.Network:
              return this.queryNetwork(target);
            case QueryType.Nodes:
              return this.queryNodes(target);
            case QueryType.Node:
              return this.queryNode(target, from, to);
            case QueryType.Leaderboard:
              return this.queryLeaderboard(target);
            default:
              return this.queryNetwork(target);
          }
        } catch (error) {
          const err = error as DataQueryError;
          return {
            refId: target.refId,
            error: { message: err.message || "Query failed" },
          };
        }
      });

    const results = await Promise.all(promises);
    return { data: results.flat() };
  }

  /**
   * Query network overview
   */
  private async queryNetwork(target: PnodePulseQuery): Promise<MutableDataFrame> {
    const response = await this.request<NetworkOverview>("/api/v1/network");

    const frame = new MutableDataFrame({
      refId: target.refId,
      name: "Network Overview",
      fields: [
        { name: "metric", type: FieldType.string },
        { name: "value", type: FieldType.number },
      ],
    });

    frame.add({ metric: "Total Nodes", value: response.nodes.total });
    frame.add({ metric: "Active Nodes", value: response.nodes.active });
    frame.add({ metric: "Inactive Nodes", value: response.nodes.inactive });
    frame.add({ metric: "Avg CPU %", value: response.metrics.avgCpuPercent });
    frame.add({ metric: "Avg RAM %", value: response.metrics.avgRamPercent });
    frame.add({
      metric: "Total Storage (GB)",
      value: response.metrics.totalStorageBytes / 1e9,
    });
    frame.add({
      metric: "Avg Uptime (hours)",
      value: response.metrics.avgUptimeSeconds / 3600,
    });

    return frame;
  }

  /**
   * Query nodes list
   */
  private async queryNodes(target: PnodePulseQuery): Promise<MutableDataFrame> {
    const params = new URLSearchParams();
    if (target.status) params.append("status", target.status);
    if (target.limit) params.append("limit", target.limit.toString());

    const url = "/api/v1/nodes?" + params.toString();
    const response = await this.request<{ nodes: Node[]; total: number }>(url);

    const frame = new MutableDataFrame({
      refId: target.refId,
      name: "Nodes",
      fields: [
        { name: "id", type: FieldType.number },
        { name: "address", type: FieldType.string },
        { name: "version", type: FieldType.string },
        { name: "isActive", type: FieldType.boolean },
        { name: "lastSeen", type: FieldType.time },
      ],
    });

    for (const node of response.nodes) {
      frame.add({
        id: node.id,
        address: node.address,
        version: node.version || "unknown",
        isActive: node.isActive,
        lastSeen: node.lastSeen ? dateTime(node.lastSeen).valueOf() : null,
      });
    }

    return frame;
  }

  /**
   * Query individual node metrics
   */
  private async queryNode(
    target: PnodePulseQuery,
    _from: number,
    _to: number
  ): Promise<MutableDataFrame[]> {
    const nodeId = target.nodeId || getTemplateSrv().replace(target.nodeAddress || "");
    if (!nodeId) {
      throw new Error("Node ID or address is required");
    }

    // Get node metrics
    const params = new URLSearchParams();
    params.append("range", target.timeRange || "24h");
    params.append("aggregation", target.aggregation || "hourly");

    const url = "/api/v1/nodes/" + nodeId + "/metrics?" + params.toString();
    const response = await this.request<NodeMetrics>(url);

    // Create time series frames for each metric
    const frames: MutableDataFrame[] = [];

    // CPU Frame
    const cpuFrame = new MutableDataFrame({
      refId: target.refId,
      name: "Node " + nodeId + " CPU",
      fields: [
        { name: "time", type: FieldType.time },
        { name: "cpu_percent", type: FieldType.number },
      ],
    });

    // RAM Frame
    const ramFrame = new MutableDataFrame({
      refId: target.refId,
      name: "Node " + nodeId + " RAM",
      fields: [
        { name: "time", type: FieldType.time },
        { name: "ram_percent", type: FieldType.number },
      ],
    });

    // Storage Frame
    const storageFrame = new MutableDataFrame({
      refId: target.refId,
      name: "Node " + nodeId + " Storage",
      fields: [
        { name: "time", type: FieldType.time },
        { name: "storage_gb", type: FieldType.number },
      ],
    });

    for (const point of response.data) {
      const timestamp = dateTime(point.time).valueOf();
      cpuFrame.add({ time: timestamp, cpu_percent: point.cpuPercent });
      ramFrame.add({ time: timestamp, ram_percent: point.ramPercent });
      storageFrame.add({
        time: timestamp,
        storage_gb: point.storageBytes / 1e9,
      });
    }

    // Return only the requested metric frame or all
    if (target.metric === "cpu") return [cpuFrame];
    if (target.metric === "ram") return [ramFrame];
    if (target.metric === "storage") return [storageFrame];
    return [cpuFrame, ramFrame, storageFrame];
  }

  /**
   * Query leaderboard
   */
  private async queryLeaderboard(
    target: PnodePulseQuery
  ): Promise<MutableDataFrame> {
    const params = new URLSearchParams();
    params.append("metric", target.metric || "uptime");
    params.append("limit", (target.limit || 10).toString());

    const url = "/api/v1/leaderboard?" + params.toString();
    const response = await this.request<Leaderboard>(url);

    const frame = new MutableDataFrame({
      refId: target.refId,
      name: "Leaderboard - " + response.metric,
      fields: [
        { name: "rank", type: FieldType.number },
        { name: "address", type: FieldType.string },
        { name: "version", type: FieldType.string },
        { name: "value", type: FieldType.number },
        { name: "uptime_hours", type: FieldType.number },
        { name: "cpu_percent", type: FieldType.number },
        { name: "ram_percent", type: FieldType.number },
        { name: "storage_gb", type: FieldType.number },
      ],
    });

    for (const entry of response.rankings) {
      frame.add({
        rank: entry.rank,
        address: entry.address,
        version: entry.version,
        value: entry.value,
        uptime_hours: entry.metrics.uptimeSeconds / 3600,
        cpu_percent: entry.metrics.cpuPercent,
        ram_percent: entry.metrics.ramPercent,
        storage_gb: entry.metrics.storageBytes / 1e9,
      });
    }

    return frame;
  }

  /**
   * Test datasource connection
   */
  async testDatasource(): Promise<{ status: string; message: string }> {
    try {
      await this.request<NetworkOverview>("/api/v1/network");
      return {
        status: "success",
        message: "Successfully connected to pNode Pulse API",
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to connect: " + (error as Error).message,
      };
    }
  }

  /**
   * Make authenticated request to pNode Pulse API
   */
  private async request<T>(path: string): Promise<T> {
    const response = getBackendSrv().fetch<T>({
      url: this.url + path,
      method: "GET",
    });
    const result = await lastValueFrom(response);
    return result.data;
  }
}

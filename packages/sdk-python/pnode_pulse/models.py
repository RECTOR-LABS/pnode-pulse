"""
Pydantic models for pNode Pulse API responses.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NodeCounts(BaseModel):
    """Node count statistics."""

    total: int
    active: int
    inactive: int


class VersionCount(BaseModel):
    """Version distribution entry."""

    version: str
    count: int


class NetworkMetrics(BaseModel):
    """Aggregate network metrics."""

    total_storage_bytes: int = Field(alias="totalStorageBytes")
    avg_cpu_percent: float = Field(alias="avgCpuPercent")
    avg_ram_percent: float = Field(alias="avgRamPercent")
    avg_uptime_seconds: int = Field(alias="avgUptimeSeconds")
    timestamp: datetime

    class Config:
        populate_by_name = True


class NetworkOverview(BaseModel):
    """Network overview response."""

    nodes: NodeCounts
    versions: list[VersionCount]
    metrics: NetworkMetrics


class CpuStats(BaseModel):
    """CPU statistics with percentiles."""

    avg: float
    min: float
    max: float
    p50: float
    p90: float
    p99: float


class RamStats(BaseModel):
    """RAM statistics with percentiles."""

    avg_percent: float = Field(alias="avgPercent")
    min_percent: float = Field(alias="minPercent")
    max_percent: float = Field(alias="maxPercent")
    p50: float
    p90: float
    p99: float

    class Config:
        populate_by_name = True


class StorageStats(BaseModel):
    """Storage statistics."""

    total: int
    avg: int


class UptimeStats(BaseModel):
    """Uptime statistics."""

    avg_seconds: int = Field(alias="avgSeconds")

    class Config:
        populate_by_name = True


class NetworkStats(BaseModel):
    """Detailed network statistics."""

    cpu: CpuStats
    ram: RamStats
    storage: StorageStats
    uptime: UptimeStats
    node_count: int = Field(alias="nodeCount")

    class Config:
        populate_by_name = True


class Node(BaseModel):
    """Basic node information."""

    id: int
    address: str
    pubkey: Optional[str] = None
    version: Optional[str] = None
    is_active: bool = Field(alias="isActive")
    last_seen: Optional[datetime] = Field(alias="lastSeen", default=None)
    first_seen: datetime = Field(alias="firstSeen")

    class Config:
        populate_by_name = True


class NodeMetricsData(BaseModel):
    """Current metrics for a node."""

    cpu_percent: Optional[float] = Field(alias="cpuPercent", default=None)
    ram_used_bytes: int = Field(alias="ramUsedBytes")
    ram_total_bytes: int = Field(alias="ramTotalBytes")
    ram_percent: float = Field(alias="ramPercent")
    storage_bytes: int = Field(alias="storageBytes")
    uptime_seconds: Optional[int] = Field(alias="uptimeSeconds", default=None)
    packets_received: Optional[int] = Field(alias="packetsReceived", default=None)
    packets_sent: Optional[int] = Field(alias="packetsSent", default=None)
    timestamp: datetime

    class Config:
        populate_by_name = True


class NodeDetails(BaseModel):
    """Detailed node information."""

    id: int
    address: str
    pubkey: Optional[str] = None
    version: Optional[str] = None
    is_active: bool = Field(alias="isActive")
    last_seen: Optional[datetime] = Field(alias="lastSeen", default=None)
    first_seen: datetime = Field(alias="firstSeen")
    metrics: Optional[NodeMetricsData] = None
    peer_count: int = Field(alias="peerCount")
    metrics_count: int = Field(alias="metricsCount")

    class Config:
        populate_by_name = True


class MetricPoint(BaseModel):
    """Single metric data point."""

    time: datetime
    cpu_percent: float = Field(alias="cpuPercent")
    ram_percent: float = Field(alias="ramPercent")
    storage_bytes: int = Field(alias="storageBytes")
    uptime_seconds: int = Field(alias="uptimeSeconds")

    class Config:
        populate_by_name = True


class NodeMetrics(BaseModel):
    """Historical metrics for a node."""

    node_id: int = Field(alias="nodeId")
    range: str
    aggregation: str
    data: list[MetricPoint]

    class Config:
        populate_by_name = True


class NodesList(BaseModel):
    """Paginated list of nodes."""

    nodes: list[Node]
    total: int
    limit: int
    offset: int
    has_more: bool = Field(alias="hasMore")

    class Config:
        populate_by_name = True


class LeaderboardMetrics(BaseModel):
    """Metrics for a leaderboard entry."""

    uptime_seconds: int = Field(alias="uptimeSeconds")
    cpu_percent: float = Field(alias="cpuPercent")
    ram_percent: float = Field(alias="ramPercent")
    storage_bytes: int = Field(alias="storageBytes")

    class Config:
        populate_by_name = True


class LeaderboardEntry(BaseModel):
    """Single leaderboard entry."""

    rank: int
    node_id: int = Field(alias="nodeId")
    address: str
    version: str
    value: float
    metrics: LeaderboardMetrics

    class Config:
        populate_by_name = True


class Leaderboard(BaseModel):
    """Leaderboard response."""

    metric: str
    period: str
    order: str
    rankings: list[LeaderboardEntry]


class RateLimitInfo(BaseModel):
    """Rate limit information from response headers."""

    limit: int
    remaining: int
    reset: int

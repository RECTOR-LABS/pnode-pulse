"""
pNode Pulse Python SDK

Official Python SDK for accessing pNode network data via the pNode Pulse API.

Example:
    >>> from pnode_pulse import PnodePulse
    >>>
    >>> # Anonymous access (30 req/min)
    >>> client = PnodePulse()
    >>>
    >>> # Authenticated access (higher limits)
    >>> client = PnodePulse(api_key="pk_live_...")
    >>>
    >>> # Get network overview
    >>> network = client.network.get_overview()
    >>> print(f"Active nodes: {network.nodes.active}")
    >>>
    >>> # Get node details
    >>> node = client.nodes.get(1)
    >>> print(f"Node uptime: {node.metrics.uptime_seconds if node.metrics else 'N/A'}")

Async Example:
    >>> import asyncio
    >>> from pnode_pulse import AsyncPnodePulse
    >>>
    >>> async def main():
    ...     client = AsyncPnodePulse(api_key="pk_live_...")
    ...     network = await client.network.get_overview()
    ...     print(f"Total nodes: {network.nodes.total}")
    >>>
    >>> asyncio.run(main())
"""

from pnode_pulse.client import PnodePulse, AsyncPnodePulse
from pnode_pulse.models import (
    NetworkOverview,
    NetworkStats,
    Node,
    NodeDetails,
    NodeMetrics,
    NodesList,
    Leaderboard,
    LeaderboardEntry,
    RateLimitInfo,
)
from pnode_pulse.exceptions import (
    PnodePulseError,
    RateLimitError,
    NotFoundError,
    AuthenticationError,
)

__version__ = "0.1.0"
__all__ = [
    "PnodePulse",
    "AsyncPnodePulse",
    "NetworkOverview",
    "NetworkStats",
    "Node",
    "NodeDetails",
    "NodeMetrics",
    "NodesList",
    "Leaderboard",
    "LeaderboardEntry",
    "RateLimitInfo",
    "PnodePulseError",
    "RateLimitError",
    "NotFoundError",
    "AuthenticationError",
]

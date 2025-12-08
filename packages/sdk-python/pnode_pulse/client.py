"""
HTTP client implementation for pNode Pulse API.
"""

from typing import Any, Optional, Union, Literal
import httpx

from pnode_pulse.models import (
    NetworkOverview,
    NetworkStats,
    Node,
    NodeDetails,
    NodeMetrics,
    NodesList,
    Leaderboard,
    RateLimitInfo,
)
from pnode_pulse.exceptions import (
    PnodePulseError,
    RateLimitError,
    NotFoundError,
    AuthenticationError,
    NetworkError,
    TimeoutError as PnodeTimeoutError,
)


DEFAULT_BASE_URL = "https://pulse.rectorspace.com"
DEFAULT_TIMEOUT = 30.0


class BaseClient:
    """Base HTTP client with common functionality."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def _parse_rate_limit(self, headers: httpx.Headers) -> RateLimitInfo:
        return RateLimitInfo(
            limit=int(headers.get("X-RateLimit-Limit", 0)),
            remaining=int(headers.get("X-RateLimit-Remaining", 0)),
            reset=int(headers.get("X-RateLimit-Reset", 0)),
        )

    def _handle_error_response(
        self, response: httpx.Response, rate_limit: RateLimitInfo
    ) -> None:
        try:
            data = response.json()
            error = data.get("error", {})
            message = error.get("message", "Unknown error")
            code = error.get("code", "UNKNOWN_ERROR")
        except Exception:
            message = response.text or "Unknown error"
            code = "UNKNOWN_ERROR"

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            raise RateLimitError(message, retry_after, rate_limit)
        elif response.status_code == 404:
            raise NotFoundError(message)
        elif response.status_code == 401:
            raise AuthenticationError(message)
        else:
            raise PnodePulseError(message, code, response.status_code, rate_limit)


class NetworkResource:
    """Network-level API endpoints."""

    def __init__(self, client: "PnodePulse"):
        self._client = client

    def get_overview(self) -> NetworkOverview:
        """Get network overview including node counts and aggregate metrics."""
        data = self._client._request("GET", "/api/v1/network")
        return NetworkOverview.model_validate(data)

    def get_stats(self) -> NetworkStats:
        """Get detailed network statistics with percentiles."""
        data = self._client._request("GET", "/api/v1/network/stats")
        return NetworkStats.model_validate(data)


class NodesResource:
    """Node-level API endpoints."""

    def __init__(self, client: "PnodePulse"):
        self._client = client

    def list(
        self,
        status: Literal["all", "active", "inactive"] = "all",
        version: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        order_by: Literal["lastSeen", "firstSeen", "address", "version"] = "lastSeen",
        order: Literal["asc", "desc"] = "desc",
    ) -> NodesList:
        """List nodes with optional filtering and pagination."""
        params: dict[str, Any] = {
            "status": status,
            "limit": limit,
            "offset": offset,
            "orderBy": order_by,
            "order": order,
        }
        if version:
            params["version"] = version
        if search:
            params["search"] = search

        data = self._client._request("GET", "/api/v1/nodes", params=params)
        return NodesList.model_validate(data)

    def get(self, id_or_address: Union[int, str]) -> NodeDetails:
        """Get detailed information about a specific node."""
        data = self._client._request("GET", f"/api/v1/nodes/{id_or_address}")
        return NodeDetails.model_validate(data)

    def get_metrics(
        self,
        node_id: int,
        range: Literal["1h", "24h", "7d", "30d"] = "24h",
        aggregation: Literal["raw", "hourly", "daily"] = "hourly",
    ) -> NodeMetrics:
        """Get historical metrics for a node."""
        params = {"range": range, "aggregation": aggregation}
        data = self._client._request(
            "GET", f"/api/v1/nodes/{node_id}/metrics", params=params
        )
        return NodeMetrics.model_validate(data)


class LeaderboardResource:
    """Leaderboard API endpoints."""

    def __init__(self, client: "PnodePulse"):
        self._client = client

    def get(
        self,
        metric: Literal["uptime", "cpu", "ram", "storage"] = "uptime",
        order: Literal["top", "bottom"] = "top",
        limit: int = 10,
        period: Literal["24h", "7d", "30d", "all"] = "7d",
    ) -> Leaderboard:
        """Get node rankings by specified metric."""
        params = {"metric": metric, "order": order, "limit": limit, "period": period}
        data = self._client._request("GET", "/api/v1/leaderboard", params=params)
        return Leaderboard.model_validate(data)

    def top_uptime(self, limit: int = 10) -> Leaderboard:
        """Get top performers by uptime."""
        return self.get(metric="uptime", order="top", limit=limit)

    def top_efficiency(self, limit: int = 10) -> Leaderboard:
        """Get most efficient nodes (lowest CPU usage)."""
        return self.get(metric="cpu", order="top", limit=limit)

    def top_storage(self, limit: int = 10) -> Leaderboard:
        """Get highest storage capacity nodes."""
        return self.get(metric="storage", order="top", limit=limit)


class PnodePulse(BaseClient):
    """
    Synchronous pNode Pulse API client.

    Example:
        >>> client = PnodePulse(api_key="pk_live_...")
        >>> network = client.network.get_overview()
        >>> print(f"Active nodes: {network.nodes.active}")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        super().__init__(api_key, base_url, timeout)
        self._http = httpx.Client(timeout=timeout)
        self.network = NetworkResource(self)
        self.nodes = NodesResource(self)
        self.leaderboard = LeaderboardResource(self)

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        try:
            response = self._http.request(
                method=method,
                url=url,
                params=params,
                headers=self._get_headers(),
            )
        except httpx.TimeoutException:
            raise PnodeTimeoutError()
        except httpx.RequestError as e:
            raise NetworkError(str(e))

        rate_limit = self._parse_rate_limit(response.headers)

        if not response.is_success:
            self._handle_error_response(response, rate_limit)

        return response.json()

    def close(self) -> None:
        """Close the HTTP client."""
        self._http.close()

    def __enter__(self) -> "PnodePulse":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


# Async versions


class AsyncNetworkResource:
    """Async network-level API endpoints."""

    def __init__(self, client: "AsyncPnodePulse"):
        self._client = client

    async def get_overview(self) -> NetworkOverview:
        """Get network overview including node counts and aggregate metrics."""
        data = await self._client._request("GET", "/api/v1/network")
        return NetworkOverview.model_validate(data)

    async def get_stats(self) -> NetworkStats:
        """Get detailed network statistics with percentiles."""
        data = await self._client._request("GET", "/api/v1/network/stats")
        return NetworkStats.model_validate(data)


class AsyncNodesResource:
    """Async node-level API endpoints."""

    def __init__(self, client: "AsyncPnodePulse"):
        self._client = client

    async def list(
        self,
        status: Literal["all", "active", "inactive"] = "all",
        version: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        order_by: Literal["lastSeen", "firstSeen", "address", "version"] = "lastSeen",
        order: Literal["asc", "desc"] = "desc",
    ) -> NodesList:
        """List nodes with optional filtering and pagination."""
        params: dict[str, Any] = {
            "status": status,
            "limit": limit,
            "offset": offset,
            "orderBy": order_by,
            "order": order,
        }
        if version:
            params["version"] = version
        if search:
            params["search"] = search

        data = await self._client._request("GET", "/api/v1/nodes", params=params)
        return NodesList.model_validate(data)

    async def get(self, id_or_address: Union[int, str]) -> NodeDetails:
        """Get detailed information about a specific node."""
        data = await self._client._request("GET", f"/api/v1/nodes/{id_or_address}")
        return NodeDetails.model_validate(data)

    async def get_metrics(
        self,
        node_id: int,
        range: Literal["1h", "24h", "7d", "30d"] = "24h",
        aggregation: Literal["raw", "hourly", "daily"] = "hourly",
    ) -> NodeMetrics:
        """Get historical metrics for a node."""
        params = {"range": range, "aggregation": aggregation}
        data = await self._client._request(
            "GET", f"/api/v1/nodes/{node_id}/metrics", params=params
        )
        return NodeMetrics.model_validate(data)


class AsyncLeaderboardResource:
    """Async leaderboard API endpoints."""

    def __init__(self, client: "AsyncPnodePulse"):
        self._client = client

    async def get(
        self,
        metric: Literal["uptime", "cpu", "ram", "storage"] = "uptime",
        order: Literal["top", "bottom"] = "top",
        limit: int = 10,
        period: Literal["24h", "7d", "30d", "all"] = "7d",
    ) -> Leaderboard:
        """Get node rankings by specified metric."""
        params = {"metric": metric, "order": order, "limit": limit, "period": period}
        data = await self._client._request("GET", "/api/v1/leaderboard", params=params)
        return Leaderboard.model_validate(data)

    async def top_uptime(self, limit: int = 10) -> Leaderboard:
        """Get top performers by uptime."""
        return await self.get(metric="uptime", order="top", limit=limit)

    async def top_efficiency(self, limit: int = 10) -> Leaderboard:
        """Get most efficient nodes (lowest CPU usage)."""
        return await self.get(metric="cpu", order="top", limit=limit)

    async def top_storage(self, limit: int = 10) -> Leaderboard:
        """Get highest storage capacity nodes."""
        return await self.get(metric="storage", order="top", limit=limit)


class AsyncPnodePulse(BaseClient):
    """
    Asynchronous pNode Pulse API client.

    Example:
        >>> async with AsyncPnodePulse(api_key="pk_live_...") as client:
        ...     network = await client.network.get_overview()
        ...     print(f"Active nodes: {network.nodes.active}")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        super().__init__(api_key, base_url, timeout)
        self._http = httpx.AsyncClient(timeout=timeout)
        self.network = AsyncNetworkResource(self)
        self.nodes = AsyncNodesResource(self)
        self.leaderboard = AsyncLeaderboardResource(self)

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        try:
            response = await self._http.request(
                method=method,
                url=url,
                params=params,
                headers=self._get_headers(),
            )
        except httpx.TimeoutException:
            raise PnodeTimeoutError()
        except httpx.RequestError as e:
            raise NetworkError(str(e))

        rate_limit = self._parse_rate_limit(response.headers)

        if not response.is_success:
            self._handle_error_response(response, rate_limit)

        return response.json()

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncPnodePulse":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

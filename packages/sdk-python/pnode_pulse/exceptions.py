"""
Custom exceptions for pNode Pulse SDK.
"""

from typing import Optional
from pnode_pulse.models import RateLimitInfo


class PnodePulseError(Exception):
    """Base exception for pNode Pulse SDK."""

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status: Optional[int] = None,
        rate_limit: Optional[RateLimitInfo] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.rate_limit = rate_limit


class RateLimitError(PnodePulseError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        retry_after: int,
        rate_limit: RateLimitInfo,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status=429,
            rate_limit=rate_limit,
        )
        self.retry_after = retry_after


class NotFoundError(PnodePulseError):
    """Raised when a resource is not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, code="NOT_FOUND", status=404)


class AuthenticationError(PnodePulseError):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, code="UNAUTHORIZED", status=401)


class ValidationError(PnodePulseError):
    """Raised when request validation fails."""

    def __init__(self, message: str):
        super().__init__(message=message, code="VALIDATION_ERROR", status=400)


class NetworkError(PnodePulseError):
    """Raised when a network error occurs."""

    def __init__(self, message: str):
        super().__init__(message=message, code="NETWORK_ERROR")


class TimeoutError(PnodePulseError):
    """Raised when a request times out."""

    def __init__(self, message: str = "Request timed out"):
        super().__init__(message=message, code="TIMEOUT")

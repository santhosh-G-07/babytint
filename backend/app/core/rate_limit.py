import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_LOCK = threading.Lock()
_HITS: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request) -> str:
    # Railway (and most PaaS) terminate TLS at a reverse proxy, so
    # request.client.host is the proxy's address, not the real caller --
    # without this every client would collapse into one shared bucket.
    # X-Forwarded-For's leftmost entry is the original client per the
    # standard proxy-chain convention; trust it since Railway's edge sets it.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def rate_limiter(bucket: str, limit: int, window_seconds: int):
    def _dependency(request: Request) -> None:
        key = f"{bucket}:{_client_key(request)}"
        now = time.monotonic()
        cutoff = now - window_seconds

        with _LOCK:
            hits = _HITS[key]
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= limit:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please wait a moment and try again.",
                )
            hits.append(now)

    return _dependency

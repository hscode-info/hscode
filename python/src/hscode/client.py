import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Iterable, List, Optional, Union

from . import __version__
from .errors import HscodeError
from .types import (
    BatchInput,
    ChaptersResponse,
    ClassifyBatchResponse,
    ClassifyResponse,
    CodeDetail,
    DutiesResponse,
    Lang,
    Mode,
    SearchResponse,
    SnapshotsResponse,
)

MAX_BATCH = 25

Opener = Callable[..., Any]


def _invalid(message: str) -> HscodeError:
    return HscodeError(0, "invalid_request", message)


def normalize_code(code: str) -> str:
    digits = re.sub(r"[\s.]", "", str(code))
    if not re.fullmatch(r"\d{10}", digits):
        raise _invalid(f'Goods code must have 10 digits, got "{code}".')
    return digits


def _segment(value: str) -> str:
    return urllib.parse.quote(str(value), safe="")


class Client:
    """Client for the hscode.info EU customs tariff (TARIC) API.

    `opener(request, timeout=...)` returns a context manager with `read()`.
    It defaults to `urllib.request.urlopen` and exists so tests can fake the network.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://hscode.info",
        timeout: float = 60,
        opener: Optional[Opener] = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("HSCODE_KEY")
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._opener: Opener = opener or urllib.request.urlopen

    def _request(
        self,
        method: str,
        path: str,
        query: Optional[Dict[str, Optional[str]]] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> Any:
        if not self._api_key:
            raise HscodeError(
                0, "missing_api_key", "No API key. Pass api_key or set HSCODE_KEY."
            )
        url = self._base_url + path
        params = {k: v for k, v in (query or {}).items() if v is not None}
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": f"hscode-python/{__version__}",
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener(request, timeout=self._timeout) as response:
                raw = response.read()
        except urllib.error.HTTPError as e:
            raise self._http_error(e) from None
        except OSError as e:
            raise HscodeError(0, "network_error", f"Network error: {e}") from e
        try:
            return json.loads(raw)
        except ValueError:
            raise HscodeError(
                0, "invalid_response", "The API returned a body that is not JSON."
            ) from None

    @staticmethod
    def _http_error(e: urllib.error.HTTPError) -> HscodeError:
        try:
            payload = json.loads(e.read())
        except (OSError, ValueError):
            payload = None
        if not isinstance(payload, dict):
            payload = {}
        return HscodeError(
            e.code,
            payload.get("error") or "http_error",
            payload.get("message") or f"Request failed with status {e.code}.",
        )

    @staticmethod
    def _year(year: Optional[str]) -> str:
        return year or "latest"

    def classify(
        self, text: str, mode: Mode = "fast", lang: Lang = "en"
    ) -> ClassifyResponse:
        return self._request(
            "POST", "/api/v1/classify", body={"text": text, "mode": mode, "lang": lang}
        )

    def classify_batch(
        self,
        items: Iterable[Union[str, BatchInput]],
        mode: Mode = "fast",
        lang: Lang = "en",
    ) -> ClassifyBatchResponse:
        entries: List[BatchInput] = [
            {"id": str(i), "text": item} if isinstance(item, str) else item
            for i, item in enumerate(items)
        ]
        if not 1 <= len(entries) <= MAX_BATCH:
            raise _invalid(
                f"classify_batch takes 1 to {MAX_BATCH} items, got {len(entries)}."
            )
        return self._request(
            "POST",
            "/api/v1/classify/batch",
            body={"items": entries, "mode": mode, "lang": lang},
        )

    def lookup(
        self,
        code: str,
        lang: Lang = "en",
        year: Optional[str] = None,
        history: bool = False,
    ) -> CodeDetail:
        code = normalize_code(code)
        year = self._year(year)
        return self._request(
            "GET",
            f"/api/v1/{_segment(lang)}/{_segment(year)}/codes/{code}",
            query={"history": "true" if history else None},
        )

    def history(
        self, code: str, lang: Lang = "en", year: Optional[str] = None
    ) -> CodeDetail:
        return self.lookup(code, lang=lang, year=year, history=True)

    def search(
        self, query: str, lang: Lang = "en", year: Optional[str] = None
    ) -> SearchResponse:
        year = self._year(year)
        return self._request(
            "GET",
            f"/api/v1/{_segment(lang)}/{_segment(year)}/search",
            query={"q": query},
        )

    def duties(self, code: str, year: Optional[str] = None) -> DutiesResponse:
        code = normalize_code(code)
        year = self._year(year)
        return self._request("GET", f"/api/v1/{_segment(year)}/duties/{code}")

    def chapters(
        self, lang: Lang = "en", year: Optional[str] = None
    ) -> ChaptersResponse:
        year = self._year(year)
        return self._request("GET", f"/api/v1/{_segment(lang)}/{_segment(year)}/chapters")

    def chapter(
        self, chapter: str, lang: Lang = "en", year: Optional[str] = None
    ) -> ChaptersResponse:
        chapter = str(chapter)
        if not re.fullmatch(r"\d{2}", chapter):
            raise _invalid(f'Chapter must have 2 digits, got "{chapter}".')
        year = self._year(year)
        return self._request(
            "GET", f"/api/v1/{_segment(lang)}/{_segment(year)}/chapters/{chapter}"
        )

    def snapshots(self) -> SnapshotsResponse:
        return self._request("GET", "/api/v1/snapshots")

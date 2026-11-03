import re
import io
import json
import os
import urllib.error

import pytest

import hscode
from hscode import Client, HscodeError

LIVE_KEY = os.environ.get("HSCODE_KEY")
LIVE = os.environ.get("HSCODE_LIVE") == "1" and bool(LIVE_KEY)

SNAPSHOTS = {"langs": ["en"], "latest": {"year": "2026", "month": "10"}, "snapshots": []}


class FakeResponse:
    def __init__(self, body):
        self._raw = json.dumps(body).encode() if not isinstance(body, bytes) else body

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeOpener:
    """Records requests and answers from `handler(call)`.

    The handler returns a body, `(status, body)` for an HTTP error, or raises.
    """

    def __init__(self, handler):
        self.handler = handler
        self.calls = []

    def __call__(self, request, timeout=None):
        call = {
            "url": request.full_url,
            "method": request.get_method(),
            "headers": {k.lower(): v for k, v in request.header_items()},
            "body": json.loads(request.data) if request.data else None,
            "timeout": timeout,
        }
        self.calls.append(call)
        out = self.handler(call)
        if isinstance(out, tuple):
            status, body = out
            raise urllib.error.HTTPError(
                request.full_url, status, "err", {}, io.BytesIO(json.dumps(body).encode())
            )
        return FakeResponse(out)

    @property
    def urls(self):
        return [c["url"] for c in self.calls]


def route(call):
    return SNAPSHOTS if call["url"].endswith("/api/v1/snapshots") else {"items": []}


def make(handler=route, **kwargs):
    opener = FakeOpener(handler)
    return Client(api_key=kwargs.pop("api_key", "k_test"), opener=opener, **kwargs), opener


def test_version_is_a_release_number():
    assert re.fullmatch(r"\d+\.\d+\.\d+", hscode.__version__)


def test_sends_auth_user_agent_and_json_body_on_classify():
    client, opener = make(lambda call: {"results": []})
    client.classify("cotton t-shirt", mode="accurate")
    (call,) = opener.calls
    assert call["url"] == "https://hscode.info/api/v1/classify"
    assert call["method"] == "POST"
    assert call["headers"]["authorization"] == "Bearer k_test"
    assert call["headers"]["user-agent"] == f"hscode-python/{hscode.__version__}"
    assert call["headers"]["accept"] == "application/json"
    assert call["headers"]["content-type"] == "application/json"
    assert call["body"] == {"text": "cotton t-shirt", "mode": "accurate", "lang": "en"}


def test_get_requests_send_no_content_type():
    client, opener = make()
    client.snapshots()
    assert "content-type" not in opener.calls[0]["headers"]


def test_uses_base_url_and_timeout():
    client, opener = make(base_url="http://localhost:5173/", timeout=5)
    client.snapshots()
    assert opener.calls[0]["url"] == "http://localhost:5173/api/v1/snapshots"
    assert opener.calls[0]["timeout"] == 5


def test_reads_key_from_environment(monkeypatch):
    monkeypatch.setenv("HSCODE_KEY", "from_env")
    opener = FakeOpener(route)
    Client(opener=opener).snapshots()
    assert opener.calls[0]["headers"]["authorization"] == "Bearer from_env"


def test_missing_key_raises_before_any_request(monkeypatch):
    monkeypatch.delenv("HSCODE_KEY", raising=False)
    opener = FakeOpener(route)
    with pytest.raises(HscodeError) as info:
        Client(opener=opener).snapshots()
    assert (info.value.status, info.value.code) == (0, "missing_api_key")
    assert opener.calls == []


def test_builds_the_url_for_each_read_method():
    client, opener = make()
    client.lookup("6109100010", lang="de", year="2025", history=True)
    client.search("t shirt", year="2026")
    client.duties("6109100010", year="2026")
    client.chapters(year="2026")
    client.chapter("61", year="2026")
    assert opener.urls == [
        "https://hscode.info/api/v1/de/2025/codes/6109100010?history=true",
        "https://hscode.info/api/v1/en/2026/search?q=t+shirt",
        "https://hscode.info/api/v1/2026/duties/6109100010",
        "https://hscode.info/api/v1/en/2026/chapters",
        "https://hscode.info/api/v1/en/2026/chapters/61",
    ]


def test_history_is_lookup_with_history():
    client, opener = make()
    client.history("6109100010", year="2026")
    assert opener.urls == ["https://hscode.info/api/v1/en/2026/codes/6109100010?history=true"]


def test_omitted_year_asks_for_latest_in_the_same_request():
    client, opener = make()
    client.lookup("6109100010")
    client.search("shirt")
    assert opener.urls == [
        "https://hscode.info/api/v1/en/latest/codes/6109100010",
        "https://hscode.info/api/v1/en/latest/search?q=shirt",
    ]


def test_accepts_codes_with_spaces_and_dots():
    client, opener = make()
    client.lookup("6109 10 00.10", year="2026")
    assert opener.urls[0].endswith("/codes/6109100010")


def test_bad_input_raises_before_any_request():
    client, opener = make()
    calls = [
        lambda: client.lookup("6109"),
        lambda: client.duties("abc"),
        lambda: client.chapter("6"),
        lambda: client.classify_batch([]),
    ]
    for call in calls:
        with pytest.raises(HscodeError) as info:
            call()
        assert (info.value.status, info.value.code) == (0, "invalid_request")
    assert opener.calls == []


@pytest.mark.parametrize("status,code", [(401, "unauthorized"), (429, "rate_limited")])
def test_http_errors_carry_status_code_and_message(status, code):
    client, _ = make(lambda call: (status, {"error": code, "message": f"msg {status}"}))
    with pytest.raises(HscodeError) as info:
        client.snapshots()
    e = info.value
    assert (e.status, e.code, e.message, str(e)) == (status, code, f"msg {status}", f"msg {status}")


def test_http_error_without_json_body_still_maps():
    def handler(call):
        raise urllib.error.HTTPError(call["url"], 502, "bad gateway", {}, io.BytesIO(b"<html>"))

    client, _ = make(handler)
    with pytest.raises(HscodeError) as info:
        client.snapshots()
    assert (info.value.status, info.value.code) == (502, "http_error")


def test_network_errors_map_to_status_zero():
    def handler(call):
        raise urllib.error.URLError("connection refused")

    client, _ = make(handler)
    with pytest.raises(HscodeError) as info:
        client.snapshots()
    assert (info.value.status, info.value.code) == (0, "network_error")


def test_timeouts_map_to_network_error():
    def handler(call):
        raise TimeoutError("timed out")

    client, _ = make(handler)
    with pytest.raises(HscodeError) as info:
        client.snapshots()
    assert info.value.code == "network_error"


def test_classify_batch_converts_strings_and_keeps_dicts():
    client, opener = make(lambda call: {"items": []})
    client.classify_batch(["shrimp", {"id": "SKU-9", "text": "nails"}], lang="de")
    call = opener.calls[0]
    assert call["url"] == "https://hscode.info/api/v1/classify/batch"
    assert call["body"] == {
        "items": [{"id": "0", "text": "shrimp"}, {"id": "SKU-9", "text": "nails"}],
        "mode": "fast",
        "lang": "de",
    }


def test_classify_batch_accepts_25_and_rejects_26():
    client, opener = make(lambda call: {"items": []})
    client.classify_batch(["x1"] * 25)
    assert len(opener.calls) == 1
    with pytest.raises(HscodeError) as info:
        client.classify_batch(["x1"] * 26)
    assert info.value.code == "invalid_request"
    assert len(opener.calls) == 1


@pytest.mark.skipif(not LIVE, reason="set HSCODE_LIVE=1 and HSCODE_KEY to run")
def test_live_api():
    client = Client(api_key=LIVE_KEY)
    assert client.snapshots()["latest"]["year"].isdigit()

    results = client.classify("cotton t-shirt")["results"]
    assert len(results[0]["goods_code"]) == 10 and results[0]["goods_code"].isdigit()

    detail = client.lookup("6109 10 00 10")
    assert any(
        d["origin_code"] == "1011" and d["meas_type_code"] == "103" for d in detail["duties"]
    )

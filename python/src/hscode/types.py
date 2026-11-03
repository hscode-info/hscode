"""Response shapes of the hscode.info API, written by hand from openapi.json.

The spec generator (datamodel-code-generator) emits `typing_extensions` and
Python 3.10 syntax, which breaks the zero-dependency, Python 3.9 target.
"""

from typing import List, Literal, Optional, TypedDict

Lang = Literal["de", "en", "fr"]
Mode = Literal["fast", "accurate"]


class Snapshot(TypedDict):
    year: str
    month: str


class SnapshotsResponse(TypedDict):
    langs: List[Lang]
    latest: Snapshot
    snapshots: List[Snapshot]


class NomenclatureItem(TypedDict):
    goods_code: str
    description: str
    indent: str
    hier_pos: int


class SearchHit(TypedDict):
    goods_code: str
    description: str


class ImportDuty(TypedDict):
    goods_code: str
    origin: str
    origin_code: str
    start_date: str
    end_date: str
    duty: str
    legal_base: str
    measure_type: str
    meas_type_code: str


class Restriction(TypedDict):
    kind: Literal["eudr", "cbam", "dual-use", "russia-import", "russia-export"]
    act: str
    annex: str
    note: str
    prefix: str
    narrower: bool


class Quota(TypedDict):
    order: str
    description: str
    origin: str
    period: str
    volume: float
    unit: str
    imported: float
    balance: float
    last_import: Optional[str]
    state: Literal["open", "critical", "exhausted"]


class TradeOrigin(TypedDict):
    country: str
    imports_eur: float


class Trade2025(TypedDict):
    imports_eur: float
    imports_kg: float
    exports_eur: float
    origins: List[TradeOrigin]
    cn8_codes: int


class Hs2028(TypedDict):
    change: Optional[Literal["split", "moved", "merged", "partial", "new-text"]]
    to: List[str]
    heading_deleted: bool


class Signals(TypedDict):
    restrictions: List[Restriction]
    quotas: List[Quota]
    quotas_as_of: Optional[str]
    trade_2025: Optional[Trade2025]
    hs2028: Optional[Hs2028]
    rules_of_origin_url: str


class HistoryEntry(TypedDict):
    year: str
    month: str
    duties: List[ImportDuty]


class _CodeDetailRequired(TypedDict):
    goods_code: str
    description: str
    hierarchy: List[NomenclatureItem]
    duties: List[ImportDuty]


class CodeDetail(_CodeDetailRequired, total=False):
    signals: Signals
    history: List[HistoryEntry]


class QuestionOption(TypedDict):
    label: str
    goods_code: str


class Question(TypedDict):
    options: List[QuestionOption]


class ClassifyResult(TypedDict):
    goods_code: str
    description: str
    path: List[str]
    score: float
    confidence: Optional[float]
    reasoning: Optional[str]
    duties: List[ImportDuty]


class ClassifyResponse(TypedDict):
    snapshot: str
    mode: Mode
    reranked: bool
    rewrite: Optional[str]
    high_confidence: bool
    results: List[ClassifyResult]
    question: Optional[Question]
    disclaimer: str


class ClassifyBatchItem(TypedDict):
    reranked: bool
    rewrite: Optional[str]
    high_confidence: bool
    results: List[ClassifyResult]
    question: Optional[Question]
    id: Optional[str]
    error: Optional[str]


class ClassifyBatchResponse(TypedDict):
    snapshot: str
    mode: Mode
    items: List[ClassifyBatchItem]
    disclaimer: str


class _BatchInputRequired(TypedDict):
    text: str


class BatchInput(_BatchInputRequired, total=False):
    id: str


class SearchResponse(TypedDict):
    items: List[SearchHit]


class DutiesResponse(TypedDict):
    items: List[ImportDuty]


class ChaptersResponse(TypedDict):
    items: List[NomenclatureItem]

using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Hscode;

public enum Lang { En, De, Fr }

public enum Mode
{
    /// <summary>Quick, 1 AI unit.</summary>
    Fast,
    /// <summary>Precise, 5 AI units, adds confidence and reasoning.</summary>
    Accurate
}

public sealed record BatchItem(string Text, string? Id = null)
{
    public static implicit operator BatchItem(string text) => new(text);
}

public sealed record Snapshot
{
    [JsonPropertyName("year")] public string Year { get; init; } = "";
    [JsonPropertyName("month")] public string Month { get; init; } = "";
}

public sealed record SnapshotsResponse
{
    [JsonPropertyName("langs")] public IReadOnlyList<string> Langs { get; init; } = new List<string>();
    [JsonPropertyName("latest")] public Snapshot Latest { get; init; } = new();
    [JsonPropertyName("snapshots")] public IReadOnlyList<Snapshot> Snapshots { get; init; } = new List<Snapshot>();
}

public sealed record NomenclatureItem
{
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
    [JsonPropertyName("description")] public string Description { get; init; } = "";
    [JsonPropertyName("indent")] public string Indent { get; init; } = "";
    [JsonPropertyName("hier_pos")] public long HierPos { get; init; }
}

public sealed record NomenclatureResponse
{
    [JsonPropertyName("items")] public IReadOnlyList<NomenclatureItem> Items { get; init; } = new List<NomenclatureItem>();
}

public sealed record SearchHit
{
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
    [JsonPropertyName("description")] public string Description { get; init; } = "";
}

public sealed record SearchResponse
{
    [JsonPropertyName("items")] public IReadOnlyList<SearchHit> Items { get; init; } = new List<SearchHit>();
}

public sealed record ImportDuty
{
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
    [JsonPropertyName("origin")] public string Origin { get; init; } = "";
    [JsonPropertyName("origin_code")] public string OriginCode { get; init; } = "";
    [JsonPropertyName("start_date")] public string StartDate { get; init; } = "";
    [JsonPropertyName("end_date")] public string EndDate { get; init; } = "";
    [JsonPropertyName("duty")] public string Duty { get; init; } = "";
    [JsonPropertyName("legal_base")] public string LegalBase { get; init; } = "";
    [JsonPropertyName("measure_type")] public string MeasureType { get; init; } = "";
    [JsonPropertyName("meas_type_code")] public string MeasTypeCode { get; init; } = "";
}

public sealed record DutiesResponse
{
    [JsonPropertyName("items")] public IReadOnlyList<ImportDuty> Items { get; init; } = new List<ImportDuty>();
}

public sealed record Restriction
{
    /// <summary>eudr, cbam, dual-use, russia-import or russia-export.</summary>
    [JsonPropertyName("kind")] public string Kind { get; init; } = "";
    [JsonPropertyName("act")] public string Act { get; init; } = "";
    [JsonPropertyName("annex")] public string Annex { get; init; } = "";
    [JsonPropertyName("note")] public string Note { get; init; } = "";
    [JsonPropertyName("prefix")] public string Prefix { get; init; } = "";
    [JsonPropertyName("narrower")] public bool Narrower { get; init; }
}

public sealed record Quota
{
    [JsonPropertyName("order")] public string Order { get; init; } = "";
    [JsonPropertyName("description")] public string Description { get; init; } = "";
    [JsonPropertyName("origin")] public string Origin { get; init; } = "";
    [JsonPropertyName("period")] public string Period { get; init; } = "";
    [JsonPropertyName("volume")] public double Volume { get; init; }
    [JsonPropertyName("unit")] public string Unit { get; init; } = "";
    [JsonPropertyName("imported")] public double Imported { get; init; }
    [JsonPropertyName("balance")] public double Balance { get; init; }
    [JsonPropertyName("last_import")] public string? LastImport { get; init; }
    /// <summary>open, critical or exhausted.</summary>
    [JsonPropertyName("state")] public string State { get; init; } = "";
}

public sealed record TradeOrigin
{
    [JsonPropertyName("country")] public string Country { get; init; } = "";
    [JsonPropertyName("imports_eur")] public double ImportsEur { get; init; }
}

public sealed record Trade
{
    [JsonPropertyName("imports_eur")] public double ImportsEur { get; init; }
    [JsonPropertyName("imports_kg")] public double ImportsKg { get; init; }
    [JsonPropertyName("exports_eur")] public double ExportsEur { get; init; }
    [JsonPropertyName("origins")] public IReadOnlyList<TradeOrigin> Origins { get; init; } = new List<TradeOrigin>();
    [JsonPropertyName("cn8_codes")] public long Cn8Codes { get; init; }
}

public sealed record Hs2028
{
    /// <summary>split, moved, merged, partial, new-text or null.</summary>
    [JsonPropertyName("change")] public string? Change { get; init; }
    [JsonPropertyName("to")] public IReadOnlyList<string> To { get; init; } = new List<string>();
    [JsonPropertyName("heading_deleted")] public bool HeadingDeleted { get; init; }
}

/// <summary>Current data from the latest snapshot, set for the latest year only.</summary>
public sealed record Signals
{
    [JsonPropertyName("restrictions")] public IReadOnlyList<Restriction> Restrictions { get; init; } = new List<Restriction>();
    [JsonPropertyName("quotas")] public IReadOnlyList<Quota> Quotas { get; init; } = new List<Quota>();
    [JsonPropertyName("quotas_as_of")] public string? QuotasAsOf { get; init; }
    [JsonPropertyName("trade_2025")] public Trade? Trade2025 { get; init; }
    [JsonPropertyName("hs2028")] public Hs2028? Hs2028 { get; init; }
    [JsonPropertyName("rules_of_origin_url")] public string RulesOfOriginUrl { get; init; } = "";
}

public sealed record HistoryEntry
{
    [JsonPropertyName("year")] public string Year { get; init; } = "";
    [JsonPropertyName("month")] public string Month { get; init; } = "";
    [JsonPropertyName("duties")] public IReadOnlyList<ImportDuty> Duties { get; init; } = new List<ImportDuty>();
}

public sealed record CodeDetail
{
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
    [JsonPropertyName("description")] public string Description { get; init; } = "";
    [JsonPropertyName("hierarchy")] public IReadOnlyList<NomenclatureItem> Hierarchy { get; init; } = new List<NomenclatureItem>();
    [JsonPropertyName("duties")] public IReadOnlyList<ImportDuty> Duties { get; init; } = new List<ImportDuty>();
    [JsonPropertyName("signals")] public Signals? Signals { get; init; }
    /// <summary>Duties in every yearly snapshot, oldest first. Set only when history was requested.</summary>
    [JsonPropertyName("history")] public IReadOnlyList<HistoryEntry>? History { get; init; }
}

public sealed record ClassifyResult
{
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
    [JsonPropertyName("description")] public string Description { get; init; } = "";
    [JsonPropertyName("path")] public IReadOnlyList<string> Path { get; init; } = new List<string>();
    [JsonPropertyName("score")] public double Score { get; init; }
    /// <summary>Model confidence 0-1, accurate mode only.</summary>
    [JsonPropertyName("confidence")] public double? Confidence { get; init; }
    /// <summary>One sentence, accurate mode only.</summary>
    [JsonPropertyName("reasoning")] public string? Reasoning { get; init; }
    [JsonPropertyName("duties")] public IReadOnlyList<ImportDuty> Duties { get; init; } = new List<ImportDuty>();
}

public sealed record QuestionOption
{
    [JsonPropertyName("label")] public string Label { get; init; } = "";
    [JsonPropertyName("goods_code")] public string GoodsCode { get; init; } = "";
}

public sealed record Question
{
    [JsonPropertyName("options")] public IReadOnlyList<QuestionOption> Options { get; init; } = new List<QuestionOption>();
}

public sealed record ClassifyResponse
{
    [JsonPropertyName("snapshot")] public string Snapshot { get; init; } = "";
    [JsonPropertyName("mode")] public string Mode { get; init; } = "";
    [JsonPropertyName("reranked")] public bool Reranked { get; init; }
    [JsonPropertyName("rewrite")] public string? Rewrite { get; init; }
    [JsonPropertyName("high_confidence")] public bool HighConfidence { get; init; }
    [JsonPropertyName("results")] public IReadOnlyList<ClassifyResult> Results { get; init; } = new List<ClassifyResult>();
    /// <summary>Set when the first result is uncertain.</summary>
    [JsonPropertyName("question")] public Question? Question { get; init; }
    [JsonPropertyName("disclaimer")] public string Disclaimer { get; init; } = "";
}

public sealed record ClassifyBatchItem
{
    [JsonPropertyName("id")] public string? Id { get; init; }
    [JsonPropertyName("reranked")] public bool Reranked { get; init; }
    [JsonPropertyName("rewrite")] public string? Rewrite { get; init; }
    [JsonPropertyName("high_confidence")] public bool HighConfidence { get; init; }
    [JsonPropertyName("results")] public IReadOnlyList<ClassifyResult> Results { get; init; } = new List<ClassifyResult>();
    [JsonPropertyName("question")] public Question? Question { get; init; }
    /// <summary>Set when this item could not be classified; its results are empty.</summary>
    [JsonPropertyName("error")] public string? Error { get; init; }
}

public sealed record ClassifyBatchResponse
{
    [JsonPropertyName("snapshot")] public string Snapshot { get; init; } = "";
    [JsonPropertyName("mode")] public string Mode { get; init; } = "";
    [JsonPropertyName("items")] public IReadOnlyList<ClassifyBatchItem> Items { get; init; } = new List<ClassifyBatchItem>();
    [JsonPropertyName("disclaimer")] public string Disclaimer { get; init; } = "";
}

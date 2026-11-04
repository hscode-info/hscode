using System;

namespace Hscode;

public sealed class HscodeClientOptions
{
    /// <summary>API key. Falls back to the HSCODE_KEY environment variable.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Defaults to https://hscode.info.</summary>
    public string BaseUrl { get; set; } = "https://hscode.info";

    /// <summary>Request timeout for the HttpClient the SDK creates itself. Ignored when you inject an HttpClient. Defaults to 60 seconds.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(60);
}

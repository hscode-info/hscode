package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Current data from the latest snapshot, set for the latest year only. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Signals {
    private final List<Restriction> restrictions;
    private final List<Quota> quotas;
    private final String quotasAsOf;
    private final Trade trade2025;
    private final Hs2028 hs2028;
    private final String rulesOfOriginUrl;

    @JsonCreator
    Signals(@JsonProperty("restrictions") List<Restriction> restrictions, @JsonProperty("quotas") List<Quota> quotas, @JsonProperty("quotas_as_of") String quotasAsOf, @JsonProperty("trade_2025") Trade trade2025, @JsonProperty("hs2028") Hs2028 hs2028, @JsonProperty("rules_of_origin_url") String rulesOfOriginUrl) {
        this.restrictions = restrictions == null ? Collections.emptyList() : List.copyOf(restrictions);
        this.quotas = quotas == null ? Collections.emptyList() : List.copyOf(quotas);
        this.quotasAsOf = quotasAsOf;
        this.trade2025 = trade2025;
        this.hs2028 = hs2028;
        this.rulesOfOriginUrl = rulesOfOriginUrl;
    }

    public List<Restriction> getRestrictions() {
        return restrictions;
    }

    public List<Quota> getQuotas() {
        return quotas;
    }

    public String getQuotasAsOf() {
        return quotasAsOf;
    }

    public Trade getTrade2025() {
        return trade2025;
    }

    public Hs2028 getHs2028() {
        return hs2028;
    }

    public String getRulesOfOriginUrl() {
        return rulesOfOriginUrl;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Signals)) return false;
        Signals that = (Signals) o;
        return Objects.equals(restrictions, that.restrictions) && Objects.equals(quotas, that.quotas) && Objects.equals(quotasAsOf, that.quotasAsOf) && Objects.equals(trade2025, that.trade2025) && Objects.equals(hs2028, that.hs2028) && Objects.equals(rulesOfOriginUrl, that.rulesOfOriginUrl);
    }

    @Override
    public int hashCode() {
        return Objects.hash(restrictions, quotas, quotasAsOf, trade2025, hs2028, rulesOfOriginUrl);
    }

    @Override
    public String toString() {
        return "Signals{" +
                "restrictions=" + restrictions +
                ", quotas=" + quotas +
                ", quotasAsOf=" + quotasAsOf +
                ", trade2025=" + trade2025 +
                ", hs2028=" + hs2028 +
                ", rulesOfOriginUrl=" + rulesOfOriginUrl +
                "}";
    }
}

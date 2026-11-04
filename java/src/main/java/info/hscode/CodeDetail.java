package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Description, hierarchy, duties and signals of a goods code. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class CodeDetail {
    private final String goodsCode;
    private final String description;
    private final List<NomenclatureItem> hierarchy;
    private final List<ImportDuty> duties;
    private final Signals signals;
    private final List<HistoryEntry> history;

    @JsonCreator
    CodeDetail(@JsonProperty("goods_code") String goodsCode, @JsonProperty("description") String description, @JsonProperty("hierarchy") List<NomenclatureItem> hierarchy, @JsonProperty("duties") List<ImportDuty> duties, @JsonProperty("signals") Signals signals, @JsonProperty("history") List<HistoryEntry> history) {
        this.goodsCode = goodsCode;
        this.description = description;
        this.hierarchy = hierarchy == null ? Collections.emptyList() : List.copyOf(hierarchy);
        this.duties = duties == null ? Collections.emptyList() : List.copyOf(duties);
        this.signals = signals;
        this.history = history == null ? Collections.emptyList() : List.copyOf(history);
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    public String getDescription() {
        return description;
    }

    public List<NomenclatureItem> getHierarchy() {
        return hierarchy;
    }

    public List<ImportDuty> getDuties() {
        return duties;
    }

    public Signals getSignals() {
        return signals;
    }

    public List<HistoryEntry> getHistory() {
        return history;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CodeDetail)) return false;
        CodeDetail that = (CodeDetail) o;
        return Objects.equals(goodsCode, that.goodsCode) && Objects.equals(description, that.description) && Objects.equals(hierarchy, that.hierarchy) && Objects.equals(duties, that.duties) && Objects.equals(signals, that.signals) && Objects.equals(history, that.history);
    }

    @Override
    public int hashCode() {
        return Objects.hash(goodsCode, description, hierarchy, duties, signals, history);
    }

    @Override
    public String toString() {
        return "CodeDetail{" +
                "goodsCode=" + goodsCode +
                ", description=" + description +
                ", hierarchy=" + hierarchy +
                ", duties=" + duties +
                ", signals=" + signals +
                ", history=" + history +
                "}";
    }
}

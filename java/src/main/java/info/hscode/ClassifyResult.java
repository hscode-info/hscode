package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** One suggested code. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ClassifyResult {
    private final String goodsCode;
    private final String description;
    private final List<String> path;
    private final double score;
    private final Double confidence;
    private final String reasoning;
    private final List<ImportDuty> duties;

    @JsonCreator
    ClassifyResult(@JsonProperty("goods_code") String goodsCode, @JsonProperty("description") String description, @JsonProperty("path") List<String> path, @JsonProperty("score") double score, @JsonProperty("confidence") Double confidence, @JsonProperty("reasoning") String reasoning, @JsonProperty("duties") List<ImportDuty> duties) {
        this.goodsCode = goodsCode;
        this.description = description;
        this.path = path == null ? Collections.emptyList() : List.copyOf(path);
        this.score = score;
        this.confidence = confidence;
        this.reasoning = reasoning;
        this.duties = duties == null ? Collections.emptyList() : List.copyOf(duties);
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getPath() {
        return path;
    }

    public double getScore() {
        return score;
    }

    public Double getConfidence() {
        return confidence;
    }

    public String getReasoning() {
        return reasoning;
    }

    public List<ImportDuty> getDuties() {
        return duties;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClassifyResult)) return false;
        ClassifyResult that = (ClassifyResult) o;
        return Objects.equals(goodsCode, that.goodsCode) && Objects.equals(description, that.description) && Objects.equals(path, that.path) && score == that.score && Objects.equals(confidence, that.confidence) && Objects.equals(reasoning, that.reasoning) && Objects.equals(duties, that.duties);
    }

    @Override
    public int hashCode() {
        return Objects.hash(goodsCode, description, path, score, confidence, reasoning, duties);
    }

    @Override
    public String toString() {
        return "ClassifyResult{" +
                "goodsCode=" + goodsCode +
                ", description=" + description +
                ", path=" + path +
                ", score=" + score +
                ", confidence=" + confidence +
                ", reasoning=" + reasoning +
                ", duties=" + duties +
                "}";
    }
}

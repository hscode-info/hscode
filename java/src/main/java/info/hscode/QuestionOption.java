package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** A branch of the follow-up question. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class QuestionOption {
    private final String label;
    private final String goodsCode;

    @JsonCreator
    QuestionOption(@JsonProperty("label") String label, @JsonProperty("goods_code") String goodsCode) {
        this.label = label;
        this.goodsCode = goodsCode;
    }

    public String getLabel() {
        return label;
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof QuestionOption)) return false;
        QuestionOption that = (QuestionOption) o;
        return Objects.equals(label, that.label) && Objects.equals(goodsCode, that.goodsCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(label, goodsCode);
    }

    @Override
    public String toString() {
        return "QuestionOption{" +
                "label=" + label +
                ", goodsCode=" + goodsCode +
                "}";
    }
}

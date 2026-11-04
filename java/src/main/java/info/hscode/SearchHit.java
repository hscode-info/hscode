package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** A code matched by a search. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class SearchHit {
    private final String goodsCode;
    private final String description;

    @JsonCreator
    SearchHit(@JsonProperty("goods_code") String goodsCode, @JsonProperty("description") String description) {
        this.goodsCode = goodsCode;
        this.description = description;
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    public String getDescription() {
        return description;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SearchHit)) return false;
        SearchHit that = (SearchHit) o;
        return Objects.equals(goodsCode, that.goodsCode) && Objects.equals(description, that.description);
    }

    @Override
    public int hashCode() {
        return Objects.hash(goodsCode, description);
    }

    @Override
    public String toString() {
        return "SearchHit{" +
                "goodsCode=" + goodsCode +
                ", description=" + description +
                "}";
    }
}

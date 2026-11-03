package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** One row of the nomenclature. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class NomenclatureItem {
    private final String goodsCode;
    private final String description;
    private final String indent;
    private final int hierPos;

    @JsonCreator
    NomenclatureItem(@JsonProperty("goods_code") String goodsCode, @JsonProperty("description") String description, @JsonProperty("indent") String indent, @JsonProperty("hier_pos") int hierPos) {
        this.goodsCode = goodsCode;
        this.description = description;
        this.indent = indent;
        this.hierPos = hierPos;
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    public String getDescription() {
        return description;
    }

    public String getIndent() {
        return indent;
    }

    public int getHierPos() {
        return hierPos;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NomenclatureItem)) return false;
        NomenclatureItem that = (NomenclatureItem) o;
        return Objects.equals(goodsCode, that.goodsCode) && Objects.equals(description, that.description) && Objects.equals(indent, that.indent) && hierPos == that.hierPos;
    }

    @Override
    public int hashCode() {
        return Objects.hash(goodsCode, description, indent, hierPos);
    }

    @Override
    public String toString() {
        return "NomenclatureItem{" +
                "goodsCode=" + goodsCode +
                ", description=" + description +
                ", indent=" + indent +
                ", hierPos=" + hierPos +
                "}";
    }
}

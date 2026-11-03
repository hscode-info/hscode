package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Extra-EU trade 2025 of the CN8 code (Eurostat Comext, CC BY 4.0). Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Trade {
    private final double importsEur;
    private final double importsKg;
    private final double exportsEur;
    private final List<TradeOrigin> origins;
    private final int cn8Codes;

    @JsonCreator
    Trade(@JsonProperty("imports_eur") double importsEur, @JsonProperty("imports_kg") double importsKg, @JsonProperty("exports_eur") double exportsEur, @JsonProperty("origins") List<TradeOrigin> origins, @JsonProperty("cn8_codes") int cn8Codes) {
        this.importsEur = importsEur;
        this.importsKg = importsKg;
        this.exportsEur = exportsEur;
        this.origins = origins == null ? Collections.emptyList() : List.copyOf(origins);
        this.cn8Codes = cn8Codes;
    }

    public double getImportsEur() {
        return importsEur;
    }

    public double getImportsKg() {
        return importsKg;
    }

    public double getExportsEur() {
        return exportsEur;
    }

    public List<TradeOrigin> getOrigins() {
        return origins;
    }

    public int getCn8Codes() {
        return cn8Codes;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Trade)) return false;
        Trade that = (Trade) o;
        return importsEur == that.importsEur && importsKg == that.importsKg && exportsEur == that.exportsEur && Objects.equals(origins, that.origins) && cn8Codes == that.cn8Codes;
    }

    @Override
    public int hashCode() {
        return Objects.hash(importsEur, importsKg, exportsEur, origins, cn8Codes);
    }

    @Override
    public String toString() {
        return "Trade{" +
                "importsEur=" + importsEur +
                ", importsKg=" + importsKg +
                ", exportsEur=" + exportsEur +
                ", origins=" + origins +
                ", cn8Codes=" + cn8Codes +
                "}";
    }
}

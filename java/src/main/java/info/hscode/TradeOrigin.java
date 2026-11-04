package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** Extra-EU imports from one country. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class TradeOrigin {
    private final String country;
    private final double importsEur;

    @JsonCreator
    TradeOrigin(@JsonProperty("country") String country, @JsonProperty("imports_eur") double importsEur) {
        this.country = country;
        this.importsEur = importsEur;
    }

    public String getCountry() {
        return country;
    }

    public double getImportsEur() {
        return importsEur;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TradeOrigin)) return false;
        TradeOrigin that = (TradeOrigin) o;
        return Objects.equals(country, that.country) && importsEur == that.importsEur;
    }

    @Override
    public int hashCode() {
        return Objects.hash(country, importsEur);
    }

    @Override
    public String toString() {
        return "TradeOrigin{" +
                "country=" + country +
                ", importsEur=" + importsEur +
                "}";
    }
}

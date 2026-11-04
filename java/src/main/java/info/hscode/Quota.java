package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** A tariff quota with its balance. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Quota {
    private final String order;
    private final String description;
    private final String origin;
    private final String period;
    private final double volume;
    private final String unit;
    private final double imported;
    private final double balance;
    private final String lastImport;
    private final String state;

    @JsonCreator
    Quota(@JsonProperty("order") String order, @JsonProperty("description") String description, @JsonProperty("origin") String origin, @JsonProperty("period") String period, @JsonProperty("volume") double volume, @JsonProperty("unit") String unit, @JsonProperty("imported") double imported, @JsonProperty("balance") double balance, @JsonProperty("last_import") String lastImport, @JsonProperty("state") String state) {
        this.order = order;
        this.description = description;
        this.origin = origin;
        this.period = period;
        this.volume = volume;
        this.unit = unit;
        this.imported = imported;
        this.balance = balance;
        this.lastImport = lastImport;
        this.state = state;
    }

    public String getOrder() {
        return order;
    }

    public String getDescription() {
        return description;
    }

    public String getOrigin() {
        return origin;
    }

    public String getPeriod() {
        return period;
    }

    public double getVolume() {
        return volume;
    }

    public String getUnit() {
        return unit;
    }

    public double getImported() {
        return imported;
    }

    public double getBalance() {
        return balance;
    }

    public String getLastImport() {
        return lastImport;
    }

    public String getState() {
        return state;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Quota)) return false;
        Quota that = (Quota) o;
        return Objects.equals(order, that.order) && Objects.equals(description, that.description) && Objects.equals(origin, that.origin) && Objects.equals(period, that.period) && volume == that.volume && Objects.equals(unit, that.unit) && imported == that.imported && balance == that.balance && Objects.equals(lastImport, that.lastImport) && Objects.equals(state, that.state);
    }

    @Override
    public int hashCode() {
        return Objects.hash(order, description, origin, period, volume, unit, imported, balance, lastImport, state);
    }

    @Override
    public String toString() {
        return "Quota{" +
                "order=" + order +
                ", description=" + description +
                ", origin=" + origin +
                ", period=" + period +
                ", volume=" + volume +
                ", unit=" + unit +
                ", imported=" + imported +
                ", balance=" + balance +
                ", lastImport=" + lastImport +
                ", state=" + state +
                "}";
    }
}

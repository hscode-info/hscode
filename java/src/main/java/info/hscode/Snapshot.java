package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** A yearly TARIC snapshot. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Snapshot {
    private final String year;
    private final String month;

    @JsonCreator
    Snapshot(@JsonProperty("year") String year, @JsonProperty("month") String month) {
        this.year = year;
        this.month = month;
    }

    public String getYear() {
        return year;
    }

    public String getMonth() {
        return month;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Snapshot)) return false;
        Snapshot that = (Snapshot) o;
        return Objects.equals(year, that.year) && Objects.equals(month, that.month);
    }

    @Override
    public int hashCode() {
        return Objects.hash(year, month);
    }

    @Override
    public String toString() {
        return "Snapshot{" +
                "year=" + year +
                ", month=" + month +
                "}";
    }
}

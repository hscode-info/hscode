package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Duties of one yearly snapshot. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class HistoryEntry {
    private final String year;
    private final String month;
    private final List<ImportDuty> duties;

    @JsonCreator
    HistoryEntry(@JsonProperty("year") String year, @JsonProperty("month") String month, @JsonProperty("duties") List<ImportDuty> duties) {
        this.year = year;
        this.month = month;
        this.duties = duties == null ? Collections.emptyList() : List.copyOf(duties);
    }

    public String getYear() {
        return year;
    }

    public String getMonth() {
        return month;
    }

    public List<ImportDuty> getDuties() {
        return duties;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof HistoryEntry)) return false;
        HistoryEntry that = (HistoryEntry) o;
        return Objects.equals(year, that.year) && Objects.equals(month, that.month) && Objects.equals(duties, that.duties);
    }

    @Override
    public int hashCode() {
        return Objects.hash(year, month, duties);
    }

    @Override
    public String toString() {
        return "HistoryEntry{" +
                "year=" + year +
                ", month=" + month +
                ", duties=" + duties +
                "}";
    }
}

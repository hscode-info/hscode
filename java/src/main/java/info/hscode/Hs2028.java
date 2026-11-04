package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** How the code changes on 1 January 2028 (a guide only). Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Hs2028 {
    private final String change;
    private final List<String> to;
    private final boolean headingDeleted;

    @JsonCreator
    Hs2028(@JsonProperty("change") String change, @JsonProperty("to") List<String> to, @JsonProperty("heading_deleted") boolean headingDeleted) {
        this.change = change;
        this.to = to == null ? Collections.emptyList() : List.copyOf(to);
        this.headingDeleted = headingDeleted;
    }

    public String getChange() {
        return change;
    }

    public List<String> getTo() {
        return to;
    }

    public boolean isHeadingDeleted() {
        return headingDeleted;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Hs2028)) return false;
        Hs2028 that = (Hs2028) o;
        return Objects.equals(change, that.change) && Objects.equals(to, that.to) && headingDeleted == that.headingDeleted;
    }

    @Override
    public int hashCode() {
        return Objects.hash(change, to, headingDeleted);
    }

    @Override
    public String toString() {
        return "Hs2028{" +
                "change=" + change +
                ", to=" + to +
                ", headingDeleted=" + headingDeleted +
                "}";
    }
}

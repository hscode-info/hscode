package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Snapshot manifest. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Snapshots {
    private final List<String> langs;
    private final Snapshot latest;
    private final List<Snapshot> snapshots;

    @JsonCreator
    Snapshots(@JsonProperty("langs") List<String> langs, @JsonProperty("latest") Snapshot latest, @JsonProperty("snapshots") List<Snapshot> snapshots) {
        this.langs = langs == null ? Collections.emptyList() : List.copyOf(langs);
        this.latest = latest;
        this.snapshots = snapshots == null ? Collections.emptyList() : List.copyOf(snapshots);
    }

    public List<String> getLangs() {
        return langs;
    }

    public Snapshot getLatest() {
        return latest;
    }

    public List<Snapshot> getSnapshots() {
        return snapshots;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Snapshots)) return false;
        Snapshots that = (Snapshots) o;
        return Objects.equals(langs, that.langs) && Objects.equals(latest, that.latest) && Objects.equals(snapshots, that.snapshots);
    }

    @Override
    public int hashCode() {
        return Objects.hash(langs, latest, snapshots);
    }

    @Override
    public String toString() {
        return "Snapshots{" +
                "langs=" + langs +
                ", latest=" + latest +
                ", snapshots=" + snapshots +
                "}";
    }
}

package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Result of classifyBatch, items in request order. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ClassifyBatchResponse {
    private final String snapshot;
    private final String mode;
    private final List<ClassifyBatchItem> items;
    private final String disclaimer;

    @JsonCreator
    ClassifyBatchResponse(@JsonProperty("snapshot") String snapshot, @JsonProperty("mode") String mode, @JsonProperty("items") List<ClassifyBatchItem> items, @JsonProperty("disclaimer") String disclaimer) {
        this.snapshot = snapshot;
        this.mode = mode;
        this.items = items == null ? Collections.emptyList() : List.copyOf(items);
        this.disclaimer = disclaimer;
    }

    public String getSnapshot() {
        return snapshot;
    }

    public String getMode() {
        return mode;
    }

    public List<ClassifyBatchItem> getItems() {
        return items;
    }

    public String getDisclaimer() {
        return disclaimer;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClassifyBatchResponse)) return false;
        ClassifyBatchResponse that = (ClassifyBatchResponse) o;
        return Objects.equals(snapshot, that.snapshot) && Objects.equals(mode, that.mode) && Objects.equals(items, that.items) && Objects.equals(disclaimer, that.disclaimer);
    }

    @Override
    public int hashCode() {
        return Objects.hash(snapshot, mode, items, disclaimer);
    }

    @Override
    public String toString() {
        return "ClassifyBatchResponse{" +
                "snapshot=" + snapshot +
                ", mode=" + mode +
                ", items=" + items +
                ", disclaimer=" + disclaimer +
                "}";
    }
}

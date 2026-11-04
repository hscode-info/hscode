package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** A restriction signal (EUDR, CBAM, dual-use, Russia sanctions). Orientation only. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Restriction {
    private final String kind;
    private final String act;
    private final String annex;
    private final String note;
    private final String prefix;
    private final boolean narrower;

    @JsonCreator
    Restriction(@JsonProperty("kind") String kind, @JsonProperty("act") String act, @JsonProperty("annex") String annex, @JsonProperty("note") String note, @JsonProperty("prefix") String prefix, @JsonProperty("narrower") boolean narrower) {
        this.kind = kind;
        this.act = act;
        this.annex = annex;
        this.note = note;
        this.prefix = prefix;
        this.narrower = narrower;
    }

    public String getKind() {
        return kind;
    }

    public String getAct() {
        return act;
    }

    public String getAnnex() {
        return annex;
    }

    public String getNote() {
        return note;
    }

    public String getPrefix() {
        return prefix;
    }

    public boolean isNarrower() {
        return narrower;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Restriction)) return false;
        Restriction that = (Restriction) o;
        return Objects.equals(kind, that.kind) && Objects.equals(act, that.act) && Objects.equals(annex, that.annex) && Objects.equals(note, that.note) && Objects.equals(prefix, that.prefix) && narrower == that.narrower;
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, act, annex, note, prefix, narrower);
    }

    @Override
    public String toString() {
        return "Restriction{" +
                "kind=" + kind +
                ", act=" + act +
                ", annex=" + annex +
                ", note=" + note +
                ", prefix=" + prefix +
                ", narrower=" + narrower +
                "}";
    }
}

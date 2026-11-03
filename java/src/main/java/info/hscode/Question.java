package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Set when the first result is uncertain: the branches the results fall into, best first. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class Question {
    private final List<QuestionOption> options;

    @JsonCreator
    Question(@JsonProperty("options") List<QuestionOption> options) {
        this.options = options == null ? Collections.emptyList() : List.copyOf(options);
    }

    public List<QuestionOption> getOptions() {
        return options;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Question)) return false;
        Question that = (Question) o;
        return Objects.equals(options, that.options);
    }

    @Override
    public int hashCode() {
        return Objects.hash(options);
    }

    @Override
    public String toString() {
        return "Question{" +
                "options=" + options +
                "}";
    }
}

package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Result of classify. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ClassifyResponse {
    private final String snapshot;
    private final String mode;
    private final boolean reranked;
    private final String rewrite;
    private final boolean highConfidence;
    private final List<ClassifyResult> results;
    private final Question question;
    private final String disclaimer;

    @JsonCreator
    ClassifyResponse(@JsonProperty("snapshot") String snapshot, @JsonProperty("mode") String mode, @JsonProperty("reranked") boolean reranked, @JsonProperty("rewrite") String rewrite, @JsonProperty("high_confidence") boolean highConfidence, @JsonProperty("results") List<ClassifyResult> results, @JsonProperty("question") Question question, @JsonProperty("disclaimer") String disclaimer) {
        this.snapshot = snapshot;
        this.mode = mode;
        this.reranked = reranked;
        this.rewrite = rewrite;
        this.highConfidence = highConfidence;
        this.results = results == null ? Collections.emptyList() : List.copyOf(results);
        this.question = question;
        this.disclaimer = disclaimer;
    }

    public String getSnapshot() {
        return snapshot;
    }

    public String getMode() {
        return mode;
    }

    public boolean isReranked() {
        return reranked;
    }

    public String getRewrite() {
        return rewrite;
    }

    public boolean isHighConfidence() {
        return highConfidence;
    }

    public List<ClassifyResult> getResults() {
        return results;
    }

    public Question getQuestion() {
        return question;
    }

    public String getDisclaimer() {
        return disclaimer;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClassifyResponse)) return false;
        ClassifyResponse that = (ClassifyResponse) o;
        return Objects.equals(snapshot, that.snapshot) && Objects.equals(mode, that.mode) && reranked == that.reranked && Objects.equals(rewrite, that.rewrite) && highConfidence == that.highConfidence && Objects.equals(results, that.results) && Objects.equals(question, that.question) && Objects.equals(disclaimer, that.disclaimer);
    }

    @Override
    public int hashCode() {
        return Objects.hash(snapshot, mode, reranked, rewrite, highConfidence, results, question, disclaimer);
    }

    @Override
    public String toString() {
        return "ClassifyResponse{" +
                "snapshot=" + snapshot +
                ", mode=" + mode +
                ", reranked=" + reranked +
                ", rewrite=" + rewrite +
                ", highConfidence=" + highConfidence +
                ", results=" + results +
                ", question=" + question +
                ", disclaimer=" + disclaimer +
                "}";
    }
}

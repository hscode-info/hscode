package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** One entry of a batch result. When error is set, results is empty. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ClassifyBatchItem {
    private final boolean reranked;
    private final String rewrite;
    private final boolean highConfidence;
    private final List<ClassifyResult> results;
    private final Question question;
    private final String id;
    private final String error;

    @JsonCreator
    ClassifyBatchItem(@JsonProperty("reranked") boolean reranked, @JsonProperty("rewrite") String rewrite, @JsonProperty("high_confidence") boolean highConfidence, @JsonProperty("results") List<ClassifyResult> results, @JsonProperty("question") Question question, @JsonProperty("id") String id, @JsonProperty("error") String error) {
        this.reranked = reranked;
        this.rewrite = rewrite;
        this.highConfidence = highConfidence;
        this.results = results == null ? Collections.emptyList() : List.copyOf(results);
        this.question = question;
        this.id = id;
        this.error = error;
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

    public String getId() {
        return id;
    }

    public String getError() {
        return error;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClassifyBatchItem)) return false;
        ClassifyBatchItem that = (ClassifyBatchItem) o;
        return reranked == that.reranked && Objects.equals(rewrite, that.rewrite) && highConfidence == that.highConfidence && Objects.equals(results, that.results) && Objects.equals(question, that.question) && Objects.equals(id, that.id) && Objects.equals(error, that.error);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reranked, rewrite, highConfidence, results, question, id, error);
    }

    @Override
    public String toString() {
        return "ClassifyBatchItem{" +
                "reranked=" + reranked +
                ", rewrite=" + rewrite +
                ", highConfidence=" + highConfidence +
                ", results=" + results +
                ", question=" + question +
                ", id=" + id +
                ", error=" + error +
                "}";
    }
}

package info.hscode;

import java.util.Objects;

/** One product to classify in a batch. Immutable. */
public final class BatchItem {
    private final String id;
    private final String text;

    private BatchItem(String id, String text) {
        this.id = id;
        this.text = Objects.requireNonNull(text, "text");
    }

    /** An item without a reference. The API returns its list position as id. */
    public static BatchItem of(String text) {
        return new BatchItem(null, text);
    }

    /** An item with your own reference (SKU, line number), returned unchanged. At most 100 characters. */
    public static BatchItem of(String id, String text) {
        return new BatchItem(id, text);
    }

    /** The reference, or null. */
    public String getId() {
        return id;
    }

    public String getText() {
        return text;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BatchItem)) return false;
        BatchItem that = (BatchItem) o;
        return Objects.equals(id, that.id) && text.equals(that.text);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, text);
    }

    @Override
    public String toString() {
        return "BatchItem{id=" + id + ", text=" + text + "}";
    }
}

package info.hscode;

/** Classification mode. */
public enum Mode {
    /** Quick, 1 AI unit. */
    FAST("fast"),
    /** Precise, 5 AI units, adds confidence and reasoning. */
    ACCURATE("accurate");

    private final String value;

    Mode(String value) {
        this.value = value;
    }

    /** The wire value: fast or accurate. */
    public String value() {
        return value;
    }
}

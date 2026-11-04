package info.hscode;

/** Description language. */
public enum Lang {
    DE("de"),
    EN("en"),
    FR("fr");

    private final String value;

    Lang(String value) {
        this.value = value;
    }

    /** The wire value: de, en or fr. */
    public String value() {
        return value;
    }
}

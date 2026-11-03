package info.hscode;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/** An import measure for one origin. Immutable. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ImportDuty {
    private final String goodsCode;
    private final String origin;
    private final String originCode;
    private final String startDate;
    private final String endDate;
    private final String duty;
    private final String legalBase;
    private final String measureType;
    private final String measTypeCode;

    @JsonCreator
    ImportDuty(@JsonProperty("goods_code") String goodsCode, @JsonProperty("origin") String origin, @JsonProperty("origin_code") String originCode, @JsonProperty("start_date") String startDate, @JsonProperty("end_date") String endDate, @JsonProperty("duty") String duty, @JsonProperty("legal_base") String legalBase, @JsonProperty("measure_type") String measureType, @JsonProperty("meas_type_code") String measTypeCode) {
        this.goodsCode = goodsCode;
        this.origin = origin;
        this.originCode = originCode;
        this.startDate = startDate;
        this.endDate = endDate;
        this.duty = duty;
        this.legalBase = legalBase;
        this.measureType = measureType;
        this.measTypeCode = measTypeCode;
    }

    public String getGoodsCode() {
        return goodsCode;
    }

    public String getOrigin() {
        return origin;
    }

    public String getOriginCode() {
        return originCode;
    }

    public String getStartDate() {
        return startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public String getDuty() {
        return duty;
    }

    public String getLegalBase() {
        return legalBase;
    }

    public String getMeasureType() {
        return measureType;
    }

    public String getMeasTypeCode() {
        return measTypeCode;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ImportDuty)) return false;
        ImportDuty that = (ImportDuty) o;
        return Objects.equals(goodsCode, that.goodsCode) && Objects.equals(origin, that.origin) && Objects.equals(originCode, that.originCode) && Objects.equals(startDate, that.startDate) && Objects.equals(endDate, that.endDate) && Objects.equals(duty, that.duty) && Objects.equals(legalBase, that.legalBase) && Objects.equals(measureType, that.measureType) && Objects.equals(measTypeCode, that.measTypeCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(goodsCode, origin, originCode, startDate, endDate, duty, legalBase, measureType, measTypeCode);
    }

    @Override
    public String toString() {
        return "ImportDuty{" +
                "goodsCode=" + goodsCode +
                ", origin=" + origin +
                ", originCode=" + originCode +
                ", startDate=" + startDate +
                ", endDate=" + endDate +
                ", duty=" + duty +
                ", legalBase=" + legalBase +
                ", measureType=" + measureType +
                ", measTypeCode=" + measTypeCode +
                "}";
    }
}

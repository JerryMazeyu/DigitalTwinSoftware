import type { PlcSensorMeta } from "../../data/plcSensorMap";

type SensorTooltipProps = {
  meta: PlcSensorMeta;
  fetchedAt?: string | null;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="sensor-tooltip-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const SensorTooltip = ({ meta, fetchedAt }: SensorTooltipProps) => (
  <div className="sensor-tooltip" role="tooltip">
    <Row label="中文名" value={meta.cnName} />
    <Row label="英文名" value={meta.enName} />
    <Row label="PLC 符号" value={meta.plcSymbol} />
    <Row label="OPC 地址" value={meta.opcAddress} />
    <Row label="数据类型" value={meta.dataType} />
    <Row label="扫描周期" value={`${meta.scanPeriodMs} ms`} />
    <Row label="单位/类型" value={meta.unit} />
    <Row label="值含义" value={meta.valueMeaning} />
    {meta.remark && <Row label="备注" value={meta.remark} />}
    {fetchedAt && <Row label="最近一次拉取" value={new Date(fetchedAt).toLocaleTimeString()} />}
  </div>
);
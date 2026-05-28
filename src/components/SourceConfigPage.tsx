import { Cable, CheckCircle2, Cpu, Database, HardDrive, RadioTower, Server, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { buildDefaultSourceConfigs, type DataSourceConfig, type DataObjectType } from "../domain/sourceConfig";

const protocols: DataSourceConfig["protocol"][] = ["OPC UA", "Modbus TCP", "GigE Vision", "WebSocket", "HTTP REST", "Local File Watch"];

const roleMeta: Record<DataSourceConfig["machineRole"], { label: string; icon: typeof Cpu; description: string }> = {
  "coating-machine": {
    label: "镀膜机 / PLC",
    icon: HardDrive,
    description: "采集线速度、张力、温度、真空度、功率和设备心跳"
  },
  "industrial-pc": {
    label: "工控机 / 相机网关",
    icon: Cpu,
    description: "接收线扫相机帧流、缓存图像 URL、上报采集质量"
  },
  "algorithm-server": {
    label: "算法服务器",
    icon: Server,
    description: "返回异常检测、褶皱趋势预测、模型状态和告警事件"
  }
};

const objectTypeLabel: Record<DataObjectType, string> = {
  MachineStatus: "工艺/设备状态",
  CameraFrame: "线扫图像帧",
  DetectionResult: "异常检测结果",
  WrinklePrediction: "褶皱趋势预测",
  AlarmEvent: "告警事件",
  ControlAction: "控制建议/审计",
  SystemHealth: "系统健康"
};

export function SourceConfigPage() {
  const [configs, setConfigs] = useState<DataSourceConfig[]>(() => buildDefaultSourceConfigs());

  const enabledMappings = useMemo(
    () => configs.reduce((count, config) => count + config.mappings.filter((mapping) => mapping.enabled).length, 0),
    [configs]
  );

  const updateConfig = (id: string, patch: Partial<DataSourceConfig>) => {
    setConfigs((current) => current.map((config) => (config.id === id ? { ...config, ...patch } : config)));
  };

  const updateMapping = (configId: string, mappingIndex: number, patch: Partial<DataSourceConfig["mappings"][number]>) => {
    setConfigs((current) =>
      current.map((config) =>
        config.id === configId
          ? {
              ...config,
              mappings: config.mappings.map((mapping, index) => (index === mappingIndex ? { ...mapping, ...patch } : mapping))
            }
          : config
      )
    );
  };

  return (
    <main className="config-page" aria-label="数据采集配置">
      <section className="panel config-summary">
        <div>
          <h2>数据采集配置</h2>
          <p>配置工艺数据、线扫图像和算法结果分别从哪台机器、以什么协议、通过哪个端点进入平台。</p>
        </div>
        <div className="summary-metrics">
          <div><span>数据源</span><strong>{configs.length}</strong></div>
          <div><span>启用映射</span><strong>{enabledMappings}</strong></div>
          <div><span>网关</span><strong>IPC-GW-01</strong></div>
          <div><span>状态</span><strong>本地草案</strong></div>
        </div>
      </section>

      <section className="config-grid">
        {configs.map((config) => {
          const meta = roleMeta[config.machineRole];
          const Icon = meta.icon;
          return (
            <article className="panel source-card" key={config.id}>
              <div className="source-card-header">
                <div className="source-title">
                  <Icon size={20} />
                  <div>
                    <h3>{meta.label}</h3>
                    <p>{meta.description}</p>
                  </div>
                </div>
                <label className="switch-row">
                  <input
                    checked={config.enabled}
                    onChange={(event) => updateConfig(config.id, { enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span>{config.enabled ? "启用" : "停用"}</span>
                </label>
              </div>

              <div className="source-form">
                <label>
                  <span>源名称</span>
                  <input value={config.name} onChange={(event) => updateConfig(config.id, { name: event.target.value })} />
                </label>
                <label>
                  <span>主机地址</span>
                  <input value={config.host} onChange={(event) => updateConfig(config.id, { host: event.target.value })} />
                </label>
                <label>
                  <span>协议</span>
                  <select
                    value={config.protocol}
                    onChange={(event) => updateConfig(config.id, { protocol: event.target.value as DataSourceConfig["protocol"] })}
                  >
                    {protocols.map((protocol) => <option key={protocol}>{protocol}</option>)}
                  </select>
                </label>
                <label>
                  <span>认证</span>
                  <select
                    value={config.authMode}
                    onChange={(event) => updateConfig(config.id, { authMode: event.target.value as DataSourceConfig["authMode"] })}
                  >
                    <option value="none">none</option>
                    <option value="token">token</option>
                    <option value="certificate">certificate</option>
                    <option value="local-service-account">local-service-account</option>
                  </select>
                </label>
                <label className="wide-field">
                  <span>采集端点</span>
                  <input value={config.endpoint} onChange={(event) => updateConfig(config.id, { endpoint: event.target.value })} />
                </label>
              </div>

              <div className="mapping-table">
                <div className="mapping-head">
                  <span><Database size={14} />数据对象</span>
                  <span><Cable size={14} />通道/字段</span>
                  <span><RadioTower size={14} />频率</span>
                  <span><CheckCircle2 size={14} />启用</span>
                </div>
                {config.mappings.map((mapping, index) => (
                  <div className="mapping-row" key={`${config.id}-${mapping.objectType}-${mapping.channel}`}>
                    <strong>{objectTypeLabel[mapping.objectType]}</strong>
                    <span>{`${mapping.channel} -> ${mapping.fieldPath}`}</span>
                    <label>
                      <input
                        min={100}
                        step={100}
                        type="number"
                        value={mapping.pollIntervalMs}
                        onChange={(event) => updateMapping(config.id, index, { pollIntervalMs: Number(event.target.value) })}
                      />
                      ms
                    </label>
                    <input
                      checked={mapping.enabled}
                      onChange={(event) => updateMapping(config.id, index, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel config-audit">
        <div className="block-title"><SlidersHorizontal size={16} />接入约束</div>
        <p>配置页只维护平台侧采集映射。涉及反向控制的写入类通道仍必须经过工控机网关、权限校验、人工确认和审计记录。</p>
      </section>
    </main>
  );
}

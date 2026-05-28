# 卷对卷镀膜数字孪生 Demo

这是一个基于 `AGENTS.md` 要求实现的前端原型，用于演示卷对卷工业镀膜场景中的设备状态、线扫图像、算法结果、褶皱趋势、告警和控制建议。

## 技术栈

- TypeScript + React + Vite
- Three.js / React Three Fiber：多辊卷对卷镀膜机 3D 数字孪生示意
- ECharts：趋势曲线
- Vitest + Zod：领域数据结构校验

## 运行

```bash
npm install
npm run dev
```

默认开发地址由 Vite 输出，一般为 `http://127.0.0.1:5173/`。

## 验证

```bash
npm test
npm run build
```

## 原型边界

- 当前使用 `src/domain/mockAdapter.ts` 生成可信模拟数据流。
- `src/domain/sourceConfig.ts` 定义三类采集来源：镀膜机 PLC、工控机线扫图像服务、算法服务器推理结果。
- 顶部可切换“监控驾驶舱”和“采集配置”，配置页支持本地编辑协议、端点、认证方式、采集频率和对象映射。
- 控制相关内容仅展示建议、确认状态和审计文案，不自动下发控制。
- 图像帧使用 `/public/demo-frames/*.svg` 作为 URL 资源，按线扫图像的宽低比例模拟，未把大图塞入 JSON 状态。

## 后期 3D 数字孪生优化路径

推荐优先购买或制作镀膜机的 Web 友好 3D 模型，并接入当前 Three.js 页面。

### 推荐方案：GLB/GLTF + Three.js

优先选择或转换为 `glb` / `gltf` 格式。`fbx`、`obj` 或 CAD 文件也可以作为源文件，但建议先在 Blender、Maya 或专业 CAD 转换工具中完成减面、材质合并和部件命名，再导出给前端使用。

建议流程：

1. 将模型保存到 `public/models/coater.glb`。
2. 在建模工具中整理关键部件名称，例如 `unwind_roll`、`coating_chamber`、`line_scan_camera`、`rewind_roll`、`alarm_light`。
3. 在 `src/components/TwinMachine3D.tsx` 中用 React Three Fiber 加载模型。
4. 将实时状态绑定到模型部件，例如辊轴旋转、相机离线变灰、告警灯闪烁、检测段高亮。
5. 保持数据来源仍经过 `src/domain/mockAdapter.ts` 或后续真实接口适配层，不让模型组件直接依赖设备协议。

这种方式适合当前 Web 驾驶舱形态，加载快、维护简单，也更容易和 React 状态、图表、告警、配置页联动。

### 可选方案：Unity WebGL

如果后续需要更复杂的三维场景、设备巡视、动画编排、物理仿真，或者团队已有 Unity 工程资产，可以将数字孪生 3D 部分用 Unity 实现，再以 WebGL 形式嵌入 React 页面。

建议边界：

- React 继续负责驾驶舱 UI、趋势图、告警、配置页和业务状态。
- Unity 只负责复杂 3D 场景渲染和三维交互。
- React 与 Unity 之间通过 JS bridge、`postMessage` 或 Unity `SendMessage` 同步状态。
- 控制类操作仍必须经过后端/工控机网关、权限校验、确认机制和审计记录。

Unity 方案的代价是 WebGL 包体积更大、首屏加载更慢、内存占用更高，并且需要维护 React 与 Unity 两套工程。只有在 Three.js 难以满足三维表现或已有 Unity 资产能明显节省成本时，才建议采用。

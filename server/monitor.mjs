import { createReadStream, existsSync, promises as fsPromises, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);

const defaultConfig = {
  dataRoot: process.env.COATING_DATA_ROOT || "P:\\",
  host: process.env.COATING_API_HOST || "127.0.0.1",
  port: Number(process.env.COATING_API_PORT || 8787),
  scanIntervalMs: Number(process.env.COATING_SCAN_INTERVAL_MS || 1500),
  maxJobs: Number(process.env.COATING_MAX_JOBS || 120)
};

const contentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const toPosix = (value) => value.replaceAll("\\", "/");

const toIso = (value) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const parseTimestampFromId = (id) => {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/.exec(id);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
};

const readDirSafe = async (dir, options) => {
  try {
    return await fsPromises.readdir(dir, options);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
};

const readJsonSafe = async (file) => {
  try {
    return JSON.parse(await fsPromises.readFile(file, "utf8"));
  } catch {
    return null;
  }
};

const getFileRole = (type, side, fileName) => {
  const lower = fileName.toLowerCase();
  const extension = extname(lower);
  if (side === "input" && imageExtensions.has(extension)) return "input-image";
  if (side === "input" && lower === "request.json") return "request-json";
  if (side === "output" && extension === ".json") return "result-json";
  if (type === "trend" && side === "output" && lower === "prediction.jpg") return "prediction-image";
  if (type === "anomaly" && side === "output" && lower.includes("heatmap") && imageExtensions.has(extension)) return "heatmap";
  if (type === "anomaly" && side === "output" && imageExtensions.has(extension)) return "anomaly-map";
  return "other";
};

const buildFile = (config, absolutePath, type, id, side, fileName, stats) => ({
  name: fileName,
  url: `/api/files/${type}/${encodeURIComponent(id)}/${side}/${encodeURIComponent(fileName)}`,
  role: getFileRole(type, side, fileName),
  length: stats.size,
  lastModified: stats.mtime.toISOString()
});

const listFiles = async (config, type, id, side) => {
  const absoluteDir = join(config.dataRoot, `${type}_api`, side, id);
  const entries = await readDirSafe(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolutePath = join(absoluteDir, entry.name);
    const stats = await fsPromises.stat(absolutePath);
    files.push(buildFile(config, absolutePath, type, id, side, entry.name, stats));
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
};

const readJobJson = async (config, type, id, side, file) => {
  if (!file) return null;
  const absolutePath = join(config.dataRoot, `${type}_api`, side, id, file.name);
  return readJsonSafe(absolutePath);
};

const summarizeTrend = (inputImages, result) => ({
  level: typeof result?.pred_level === "string" ? result.pred_level : undefined,
  analogVoltage: typeof result?.analog_voltage === "number" ? result.analog_voltage : undefined,
  timestamp: typeof result?.timestamp === "string" ? result.timestamp : undefined,
  sourceImageCount: Array.isArray(result?.source_images) ? result.source_images.length : inputImages.length
});

const summarizeAnomaly = (request, result) => {
  const cropResults = Array.isArray(result?.crop_results) ? result.crop_results : [];
  const abnormalCropCount = cropResults.filter((crop) => {
    const text = typeof crop?.anomaly_level === "string" ? crop.anomaly_level : "";
    return text.includes("异常") || (typeof crop?.sample_score === "number" && crop.sample_score >= 0.2);
  }).length;
  const originalSize = Array.isArray(result?.original_size) && result.original_size.length >= 2
    ? [Number(result.original_size[0]), Number(result.original_size[1])]
    : undefined;

  return {
    level: typeof result?.anomaly_level === "string" ? result.anomaly_level : undefined,
    score: typeof result?.sample_score === "number" ? result.sample_score : undefined,
    analogVoltage: typeof result?.analog_voltage === "number" ? result.analog_voltage : undefined,
    timestamp: typeof result?.timestamp === "string" ? result.timestamp : undefined,
    imageType: typeof request?.image_type === "string" ? request.image_type : undefined,
    sourceImage: typeof request?.source_image === "string" ? request.source_image : undefined,
    cropCount: typeof result?.num_crops === "number" ? result.num_crops : cropResults.length || undefined,
    abnormalCropCount,
    originalSize
  };
};

const scanJob = async (config, type, id, inputDirReady, outputDirReady) => {
  const inputFiles = inputDirReady ? await listFiles(config, type, id, "input") : [];
  const outputFiles = outputDirReady ? await listFiles(config, type, id, "output") : [];
  const inputImages = inputFiles.filter((file) => file.role === "input-image");
  const requestFile = inputFiles.find((file) => file.role === "request-json");
  const resultFile = outputFiles.find((file) => file.role === "result-json");
  const prediction = outputFiles.find((file) => file.role === "prediction-image");
  const anomalyMap = outputFiles.find((file) => file.role === "anomaly-map");
  const heatmap = outputFiles.find((file) => file.role === "heatmap");
  const request = await readJobJson(config, type, id, "input", requestFile);
  const result = await readJobJson(config, type, id, "output", resultFile);
  const missing = [];

  if (!inputDirReady) missing.push("input directory");
  if (!outputDirReady) missing.push("output directory");
  if (inputDirReady && inputImages.length === 0) missing.push("input image");
  if (outputDirReady && !resultFile) missing.push("result json");
  if (type === "trend" && outputDirReady && !prediction) missing.push("prediction.jpg");
  if (type === "anomaly" && outputDirReady && !anomalyMap) missing.push("anomaly map");
  if (type === "anomaly" && outputDirReady && !heatmap) missing.push("heatmap");

  const hasInvalidJson = Boolean((requestFile && !request) || (resultFile && !result));
  const status = hasInvalidJson
    ? "invalid"
    : !inputDirReady
      ? "waiting-input"
      : !outputDirReady
        ? "waiting-output"
        : missing.length > 0
          ? "incomplete"
          : "ready";

  const allFiles = [...inputFiles, ...outputFiles];
  const updatedAt = allFiles
    .map((file) => new Date(file.lastModified))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    id,
    type,
    status,
    createdAt: toIso(parseTimestampFromId(id)),
    updatedAt: toIso(updatedAt) || toIso(parseTimestampFromId(id)),
    inputDirReady,
    outputDirReady,
    inputImages,
    inputFiles,
    outputFiles,
    requestFile,
    resultFile,
    outputImages: { prediction, anomalyMap, heatmap },
    request,
    result,
    summary: type === "trend" ? summarizeTrend(inputImages, result) : summarizeAnomaly(request, result),
    missing
  };
};

const listIds = async (root) => {
  const entries = await readDirSafe(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
};

export const scanCoatingJobs = async (config = defaultConfig) => {
  const rootExists = existsSync(config.dataRoot);
  const jobs = [];

  if (rootExists) {
    for (const type of ["anomaly", "trend"]) {
      const inputRoot = join(config.dataRoot, `${type}_api`, "input");
      const outputRoot = join(config.dataRoot, `${type}_api`, "output");
      const inputIds = new Set(await listIds(inputRoot));
      const outputIds = new Set(await listIds(outputRoot));
      const ids = [...new Set([...inputIds, ...outputIds])].sort((a, b) => b.localeCompare(a, "zh-CN", { numeric: true }));
      for (const id of ids) {
        jobs.push(await scanJob(config, type, id, inputIds.has(id), outputIds.has(id)));
      }
    }
  }

  jobs.sort((a, b) => {
    const left = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const right = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return right - left;
  });

  const limitedJobs = jobs.slice(0, config.maxJobs);
  const health = {
    dataRoot: config.dataRoot,
    scanIntervalMs: config.scanIntervalMs,
    lastScanAt: new Date().toISOString(),
    rootExists,
    totalJobs: jobs.length,
    readyJobs: jobs.filter((job) => job.status === "ready").length,
    trendJobs: jobs.filter((job) => job.type === "trend").length,
    anomalyJobs: jobs.filter((job) => job.type === "anomaly").length
  };

  return { jobs: limitedJobs, health };
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const sendNotFound = (response, message = "Not found") => sendJson(response, 404, { error: message });

const sendError = (response, error) => sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });

const getSafeFilePath = (config, type, id, side, fileName) => {
  if (!["anomaly", "trend"].includes(type) || !["input", "output"].includes(side)) return null;
  const root = resolve(config.dataRoot, `${type}_api`, side, id);
  const filePath = resolve(root, fileName);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (filePath !== root && !filePath.startsWith(rootWithSep)) return null;
  return filePath;
};

const streamFile = async (config, response, type, id, side, fileName) => {
  const filePath = getSafeFilePath(config, type, id, side, fileName);
  if (!filePath || !existsSync(filePath)) {
    sendNotFound(response, "File not found");
    return;
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    sendNotFound(response, "File not found");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    "content-type": contentTypes[extension] || "application/octet-stream",
    "content-length": stats.size,
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  createReadStream(filePath).pipe(response);
};

const createMonitorState = (config) => {
  const clients = new Set();
  let payload = { jobs: [], health: { dataRoot: config.dataRoot, scanIntervalMs: config.scanIntervalMs, lastScanAt: "", rootExists: false, totalJobs: 0, readyJobs: 0, trendJobs: 0, anomalyJobs: 0 } };
  let signature = "";

  const publish = (eventName = "jobs") => {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      client.write(`event: ${eventName}\n`);
      client.write(`data: ${data}\n\n`);
    }
  };

  const scan = async () => {
    payload = await scanCoatingJobs(config);
    const nextSignature = JSON.stringify(payload.jobs.map((job) => [job.type, job.id, job.status, job.updatedAt, job.missing.join("|")]));
    if (nextSignature !== signature) {
      signature = nextSignature;
      publish("jobs");
    }
    return payload;
  };

  const addClient = (response) => {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    clients.add(response);
    response.write(`event: jobs\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
    response.on("close", () => clients.delete(response));
  };

  return { get payload() { return payload; }, scan, addClient };
};

const parseRequestUrl = (request, config) => new URL(request.url || "/", `http://${config.host}:${config.port}`);

export const createMonitorServer = (config = defaultConfig) => {
  const state = createMonitorState(config);
  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      response.end();
      return;
    }

    try {
      const url = parseRequestUrl(request, config);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/api/health") {
        sendJson(response, 200, state.payload.health);
        return;
      }

      if (url.pathname === "/api/jobs") {
        sendJson(response, 200, state.payload);
        return;
      }

      if (url.pathname === "/api/events") {
        state.addClient(response);
        return;
      }

      if (parts[0] === "api" && parts[1] === "jobs" && parts.length === 4) {
        const [, , type, id] = parts;
        const job = state.payload.jobs.find((item) => item.type === type && item.id === id);
        if (!job) sendNotFound(response, "Job not found");
        else sendJson(response, 200, job);
        return;
      }

      if (parts[0] === "api" && parts[1] === "files" && parts.length === 6) {
        const [, , type, id, side, fileName] = parts;
        await streamFile(config, response, type, id, side, fileName);
        return;
      }

      if (url.pathname === "/") {
        sendJson(response, 200, {
          name: "coating-monitor-api",
          jobs: "/api/jobs",
          events: "/api/events",
          health: "/api/health",
          dataRoot: config.dataRoot
        });
        return;
      }

      sendNotFound(response);
    } catch (error) {
      sendError(response, error);
    }
  });

  const start = async () => {
    await state.scan();
    const interval = setInterval(() => {
      state.scan().catch((error) => {
        console.error("[monitor] scan failed", error);
      });
    }, config.scanIntervalMs);
    interval.unref?.();

    await new Promise((resolveListen) => {
      server.listen(config.port, config.host, resolveListen);
    });

    return { server, state, close: () => {
      clearInterval(interval);
      server.close();
    } };
  };

  return { server, state, start };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = { ...defaultConfig, dataRoot: normalize(defaultConfig.dataRoot) };
  createMonitorServer(config).start().then(() => {
    console.log(`[monitor] API ready at http://${config.host}:${config.port}`);
    console.log(`[monitor] Watching ${toPosix(config.dataRoot)}`);
  }).catch((error) => {
    console.error("[monitor] failed to start", error);
    process.exit(1);
  });
}

import winston, { format, createLogger, transports } from 'winston';
import path from 'path';
import util from 'util';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as dotenv from 'dotenv';

dotenv.config();

// --- 配置部分 (可提取到单独的配置文件) ---

/**
 * 日志配置接口。
 */
interface LoggerConfig {
  /** 是否启用日志记录 */
  enabled: boolean;
  /** 默认日志级别 */
  level: string;
  /** 日志文件路径 (已弃用, 推荐使用 dailyRotateFile) */
  file?: string;
  /** 是否输出到控制台 */
  console: boolean;
  /** 日志格式化选项 */
  format?: {
    /** 时间戳格式 */
    timestamp?: string;
    /** 是否显示文件信息 */
    showFileInfo?: boolean;
    /** 是否显示调用函数 */
    showCallerFunction?: boolean;
    /** 是否美化输出元数据 */
    prettyPrintMeta?: boolean;
  };
  /** 各个模块的日志级别 */
  moduleLevels?: Record<string, string>;
  /** DailyRotateFile 插件的配置 */
  dailyRotateFile?: DailyRotateFile.DailyRotateFileTransportOptions;
}

/**
 * 默认日志配置。
 */
const defaultConfig: LoggerConfig = {
  enabled: true,
  level: 'info', // 默认日志级别
  console: true,  // 是否输出到控制台
  format: {
    timestamp: 'YYYY-MM-DD HH:mm:ss', // 时间戳格式
    showFileInfo: true,            // 是否显示文件信息
    showCallerFunction: true,        // 是否显示调用函数
    prettyPrintMeta: false,         // 是否美化输出元数据
  },
  dailyRotateFile: { // DailyRotateFile 插件的配置
    filename: 'logs/app-%DATE%.log', // 文件名
    datePattern: 'YYYY-MM-DD',      // 日期格式
    zippedArchive: true,           // 是否压缩旧日志
    maxSize: '20m',                // 最大文件大小
    maxFiles: '14d',               // 最多保留文件数
  },
};

/**
 * 从环境变量或配置文件加载日志配置。
 * @returns {LoggerConfig} 合并后的日志配置
 */
function loadConfig(): LoggerConfig {
  let fileConfig: Partial<LoggerConfig> = {};
  if (process.env.LOG_FILE) {
    const logDir = path.dirname(process.env.LOG_FILE);
    const baseName = path.basename(process.env.LOG_FILE, path.extname(process.env.LOG_FILE)); // 获取无后缀的文件基础名
    fileConfig = {
      dailyRotateFile: {
        filename: `${logDir}/${baseName}-%DATE%.log`, // 使用基础名和日期
      }
    }
  }
  const envConfig: Partial<LoggerConfig> = {
    enabled: process.env.LOG_ENABLED === 'true',
    level: process.env.LOG_LEVEL,
    file: process.env.LOG_FILE,  // 保留 file 选项, 但主要使用 dailyRotateFile
    console: process.env.LOG_TO_CONSOLE !== 'false',
  };

  // 可以从文件加载配置 (例如 config.json 或 config.js)
  // const fileConfig = loadConfigFromFile();
  // 合并配置, 优先级:  环境变量 > 文件配置 > 默认配置
  const mergedConfig = {
    ...defaultConfig,
    ...fileConfig,
    ...envConfig,
    format: {
      ...defaultConfig.format,
      // ...fileConfig.format,
      ...(envConfig.format as any),
    },
    dailyRotateFile: {
      ...defaultConfig.dailyRotateFile,
      ...fileConfig.dailyRotateFile, // 覆盖默认的 dailyRotateFile
      ...(envConfig.dailyRotateFile as any),
    }
  };

  return mergedConfig as LoggerConfig;
}

const config = loadConfig();

// --- Winston Logger 实例 ---

const { combine, timestamp, colorize, errors, printf } = format;

/**
 * 自定义日志格式化函数。
 */
const customFormat = printf(({ timestamp, level, message, fileInfo, callerFunction, ...meta }) => {
  // 1. 组装基本信息 (时间戳、级别)
  let logMessage = `${timestamp} [${level}]`; // level 已经包含了颜色

  // 2. 添加可选信息 (调用函数、文件信息)
  if (config.format?.showCallerFunction && callerFunction) {
    logMessage += `[${callerFunction}]`;
  }
  if (config.format?.showFileInfo && fileInfo) {
    logMessage += `[${fileInfo}]`;
  }

  // 3. 添加消息主体
  logMessage += ` ${message}`;

  // 4. 处理元数据 (附加信息)
  if (Object.keys(meta).length > 0) {
    if (config.format?.prettyPrintMeta) {
      // 使用 util.inspect 进行更友好的对象输出
      logMessage += ` ${util.inspect(meta, { depth: null, colors: true, compact: false })}`;
    } else {
      // 简单地将 meta 转换为 JSON 字符串
      logMessage += ` ${JSON.stringify(meta)}`;
    }
  }

  return logMessage;
});

/**
 * 控制台日志格式化器。
 */
const consoleFormat = combine(
  timestamp({ format: config.format?.timestamp }),
  errors({ stack: true }),
  colorize({ all: true }), // 控制台启用颜色
  customFormat
);

/**
 * 文件日志格式化器。
 */
const fileFormat = combine(
  timestamp({ format: config.format?.timestamp }),
  errors({ stack: true }),
  customFormat  // 文件禁用颜色
);


const logger = createLogger({
  level: config.level,
  transports: [
    new transports.Console({ format: consoleFormat }), // 控制台使用 consoleFormat
    ...(config.dailyRotateFile
      ? [new DailyRotateFile({ ...config.dailyRotateFile, format: fileFormat })] // 文件使用 fileFormat
      : []),
  ],
  silent: !config.enabled,
});

// --- 辅助函数: 获取文件信息 ---

/**
 * 获取调用栈信息。
 * @param {number} stackLevel 堆栈层级
 * @returns {{ fileInfo: string; callerFunction: string }} 文件信息和调用函数名
 */
function getFileInfo(stackLevel: number): { fileInfo: string; callerFunction: string } {
  const stack = new Error().stack?.split('\n');
  let fileInfo = '';
  let callerFunction = '';

  if (stack && stack.length > stackLevel) {
    const callerLine = stack[stackLevel].trim();
    // 匹配两种可能的堆栈跟踪格式
    const match =
      callerLine.match(/at\s+(.+)\s+\((.+?):(\d+):\d+\)/) || // (函数名 at 文件名:行号:列号)
      callerLine.match(/at\s+(.+?):(\d+):\d+/);          // (文件名:行号:列号)

    if (match) {
      // 从匹配结果中提取文件路径、行号和函数名
      const file = path.relative(process.cwd(), match[match.length - 2]); // 获取相对于项目根目录的文件路径
      const line = match[match.length - 1];
      fileInfo = `${file}:${line}`;
      callerFunction = match[1].includes('.') ? match[1] : ''; // 提取函数名 (如果存在)
    }
  }
  return { fileInfo, callerFunction };
}

// --- 日志记录函数 (核心) ---

/**
 * 记录日志。
 * @param {string} level 日志级别
 * @param {any} message 日志消息
 * @param {...any[]} meta 元数据
 */
function log(level: string, message: any, ...meta: any[]): void {
  // 1. 获取调用位置信息
  const { fileInfo, callerFunction } = getFileInfo(4);

  // 2. (可选) 模块级别的日志过滤
  if (config.moduleLevels) {
    const moduleName = fileInfo.split(':')[0]; // 假设模块名是文件路径的第一部分
    const moduleLevel = config.moduleLevels[moduleName];
    // 如果模块设置了更严格的日志级别，则不记录
    if (moduleLevel && winston.config.npm.levels[moduleLevel] > winston.config.npm.levels[level]) {
      return;
    }
  }

  // 3. 记录日志
  logger.log(level, String(message), { fileInfo, callerFunction, ...meta });
}

// --- 导出日志接口 ---
/**
 * 日志记录器实例。
 */
const logWrapper = {
  /**
   * 记录错误日志。
   * @param {any} message 错误消息
   * @param {...any[]} meta 元数据
   */
  error: (message: any, ...meta: any[]) => log('error', message, ...meta),
  /**
   * 记录警告日志。
   * @param {any} message 警告消息
   * @param {...any[]} meta 元数据
   */
  warn: (message: any, ...meta: any[]) => log('warn', message, ...meta),
  /**
   * 记录信息日志。
   * @param {any} message 信息消息
   * @param {...any[]} meta 元数据
   */
  info: (message: any, ...meta: any[]) => log('info', message, ...meta),
  /**
   * 记录详细日志。
   * @param {any} message 详细消息
   * @param {...any[]} meta 元数据
   */
  verbose: (message: any, ...meta: any[]) => log('verbose', message, ...meta),
  /**
   * 记录调试日志。
   * @param {any} message 调试消息
   * @param {...any[]} meta 元数据
   */
  debug: (message: any, ...meta: any[]) => log('debug', message, ...meta),
  /**
   * 记录Silly日志。
   * @param {any} message  Silly消息
   * @param {...any[]} meta 元数据
   */
  silly: (message: any, ...meta: any[]) => log('silly', message, ...meta),
};

export default logWrapper;
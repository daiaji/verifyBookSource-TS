import axios, { AxiosRequestConfig, AxiosResponse, AxiosResponseHeaders } from 'axios';
import logger from './logger';

export interface NetworkResponse<T> {
    data: T;
    status: number;
    headers: Record<string, string>; // 保持 Record<string, string>
    raw: AxiosResponse; // 原始响应对象 (可选)
}

export class NetworkManager {
    private http = axios.create(); // 可以配置 axios 实例

    constructor(private baseURL?: string) { }

    async get<T>(url: string, config?: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        return this.request<T>({ ...config, method: 'POST', url, data });
    }

    // 其他请求方法 (put, delete, patch) ...

    async request<T>(config: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        try {
            if (this.baseURL && !config.baseURL) {
                config.baseURL = this.baseURL;  //应用基础 URL
            }
            const response = await this.http(config);

            // **遍历转换 headers**
            const headers: Record<string, string> = {};
            for (const key in response.headers) {
                if (Object.prototype.hasOwnProperty.call(response.headers, key)) { // 更安全的检查
                    const value = response.headers[key];
                    if (typeof value === 'string') {
                        headers[key] = value;
                    } else if (Array.isArray(value)) {
                        headers[key] = value.join(', '); // 数组转为逗号分隔的字符串
                    } else if (value !== null && value !== undefined) {
                        headers[key] = String(value);   // 其他类型转为字符串
                    } // 忽略 null 和 undefined
                }
            }

            return {
                data: response.data,
                status: response.status,
                headers: headers, // 使用转换后的 headers
                raw: response,
            };
        } catch (error: any) {
            // 统一的错误处理 (例如, 记录日志, 抛出自定义异常)
            logger.error('网络请求失败:', {
                url: config.url,
                method: config.method,
                error: error.message, // 或者更详细的错误信息
                stack: error.stack
            });
            throw new Error(`网络请求失败: ${error.message}`, { cause: error }); // 使用更现代的 Error 构造函数
        }
    }
}
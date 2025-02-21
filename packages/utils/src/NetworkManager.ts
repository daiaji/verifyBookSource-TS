import axios, { AxiosRequestConfig, AxiosResponse, AxiosResponseHeaders } from 'axios';
import logger from './logger';

export interface NetworkResponse<T> {
    data: T;
    status: number;
    headers: Record<string, string>; // 保持 Record<string, string>
    raw: AxiosResponse; // 原始响应对象 (可选)
}

export class NetworkManager {
    private http = axios.create(); // 可以配置 axios 实例, 比如 timeout

    constructor(private baseURL?: string) { }
    /**
     * 发送 GET 请求。
     * @param url 请求的 URL。
     * @param config  可选的 Axios 请求配置。
     * @returns  包含响应数据的 Promise。
     */
    async get<T>(url: string, config?: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    /**
     * 发送 POST 请求。
     * @param url 请求的 URL。
     * @param data  可选的请求体数据。
     * @param config 可选的 Axios 请求配置。
     * @returns 包含响应数据的 Promise。
     */
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
                if (Object.prototype.hasOwnProperty.call(response.headers, key)) {
                    const value = response.headers[key];
                    if (typeof value === 'string') {
                        headers[key] = value;
                    } else if (Array.isArray(value)) {
                        headers[key] = value.join(', ');
                    } else if (value !== null && value !== undefined) {
                        headers[key] = String(value);
                    }
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
                // data: config.data, // 根据需要记录请求数据
                headers: config.headers,
                error: error.message, // 或者更详细的错误信息 + 堆栈
                stack: error.stack,
                // 如果是 AxiosError，还可以包含更多信息
                ...(error.response ? {
                    status: error.response.status,
                    responseHeaders: error.response.headers,
                    responseData: error.response.data
                } : {})
            });
            // 抛出更友好的错误，包含 cause
            throw new Error(`网络请求失败: ${error.message}`, { cause: error });
        }
    }
}
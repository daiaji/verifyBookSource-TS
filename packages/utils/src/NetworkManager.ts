import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

/**
 * 网络请求响应接口。
 *
 * @template T 响应数据类型
 */
export interface NetworkResponse<T> {
    /** 响应数据 */
    data: T;
    /** 响应状态码 */
    status: number;
    /** 响应头 */
    headers: Record<string, string>; // 保持 Record<string, string>
    /** 原始的 Axios 响应对象 */
    raw: AxiosResponse;
}

/**
 * 网络请求管理器类。
 */
export class NetworkManager {
    private http = axios.create(); // 可以配置 axios 实例, 比如 timeout

    /**
     * 构造函数。
     * @param {string} [baseURL] 基础 URL
     */
    constructor(private baseURL?: string) { }

    /**
     * 发送 GET 请求。
     * @param {string} url 请求的 URL。
     * @param {AxiosRequestConfig} [config] 可选的 Axios 请求配置。
     * @returns {Promise<NetworkResponse<T>>} 包含响应数据的 Promise。
     * @template T 响应数据类型
     */
    async get<T>(url: string, config?: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    /**
     * 发送 POST 请求。
     * @param {string} url 请求的 URL。
     * @param {any} [data] 可选的请求体数据。
     * @param {AxiosRequestConfig} [config] 可选的 Axios 请求配置。
     * @returns {Promise<NetworkResponse<T>>} 包含响应数据的 Promise。
     * @template T 响应数据类型
     */
    async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<NetworkResponse<T>> {
        return this.request<T>({ ...config, method: 'POST', url, data });
    }

    // 其他请求方法 (put, delete, patch) ...

    /**
     * 发送网络请求。
     * @param {AxiosRequestConfig} config Axios 请求配置。
     * @returns {Promise<NetworkResponse<T>>} 包含响应数据的 Promise。
     * @template T 响应数据类型
     */
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
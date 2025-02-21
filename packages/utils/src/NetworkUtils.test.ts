import { NetworkUtils } from './NetworkUtils'; // Import NetworkUtils2 and rename it
import logger from './logger';

// Mock the logger to capture error messages
jest.mock('./logger', () => ({
    error: jest.fn(),
}));

describe('NetworkUtils Comparison', () => {
    const testCases = [
        // 基础 URL 和相对路径的组合
        { baseURL: "https://www.example.com", relativePath: "page1.html", expected: "https://www.example.com/page1.html" },
        { baseURL: new URL("https://www.example.com"), relativePath: "page2.html", expected: "https://www.example.com/page2.html" },
        { baseURL: null, relativePath: "page3.html", expected: "page3.html" },
        { baseURL: undefined, relativePath: "page4.html", expected: "page4.html" },
        { baseURL: "https://www.example.com,https://backup.example.com", relativePath: "page5.html", expected: "https://www.example.com/page5.html" },
        { baseURL: "invalid url", relativePath: "page6.html", expected: "page6.html" }, //baseURL解析失败
        { baseURL: "https://www.example.com", relativePath: "  page7.html  ", expected: "https://www.example.com/page7.html" },
        { baseURL: "https://www.example.com", relativePath: "javascript:alert('XSS')", expected: "" },
        { baseURL: "https://www.example.com", relativePath: "/absolute/path", expected: "https://www.example.com/absolute/path" },
        { baseURL: "https://www.example.com/path/", relativePath: "../parent.html", expected: "https://www.example.com/parent.html" },
        { baseURL: "https://www.example.com", relativePath: "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==", expected: "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==" },
        { baseURL: "", relativePath: "relative.html", expected: "relative.html" }, //baseURL 为空字符串
        { baseURL: "https://example.com/foo.html", relativePath: "//otherdomain.com/bar.html", expected: "https://otherdomain.com/bar.html" }, //测试双斜杠开头的相对路径
        { baseURL: "https://example.com/path", relativePath: "?query=string", expected: "https://example.com/path?query=string" },
        { baseURL: 'https://example.com', relativePath: '#fragment', expected: 'https://example.com/#fragment' },

        // 边界情况和异常值
        { baseURL: "https://www.example.com", relativePath: "very/long/path/" + "a".repeat(2000), expected: "https://www.example.com/very/long/path/" + "a".repeat(2000) }, // 超长路径
        { baseURL: "https://www.example.com", relativePath: "path with spaces.html", expected: "https://www.example.com/path%20with%20spaces.html" }, // 包含空格
        { baseURL: "https://www.example.com", relativePath: "你好世界.html", expected: "https://www.example.com/%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C.html" }, // 中文
        { baseURL: "https://www.example.com", relativePath: "こんにちは世界.html", expected: "https://www.example.com/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E4%B8%96%E7%95%8C.html" }, // 日文
        { baseURL: "https://www.example.com", relativePath: "  ", expected: "https://www.example.com/" },// 空格
        { baseURL: 'https://example.com:8080', relativePath: '/path', expected: 'https://example.com:8080/path' }, // 端口号

        // 更丰富的 URL 场景
        { baseURL: "https://user:pass@example.com:8080", relativePath: "page.html", expected: "https://user:pass@example.com:8080/page.html" }, // 用户名和密码
        { baseURL: "https://example.com", relativePath: "page.html?param1=value1¶m2=value2", expected: "https://example.com/page.html?param1=value1%C2%B6m2=value2" }, // 多个查询参数
        { baseURL: "https://example.com", relativePath: "page.html#section1", expected: "https://example.com/page.html#section1" }, // 片段标识符
        { baseURL: "https://example.com", relativePath: "page.html?param=value#section1", expected: "https://example.com/page.html?param=value#section1" }, // 查询参数和片段标识符
        { baseURL: "https://example.com/path/", relativePath: "./page.html", expected: "https://example.com/path/page.html" }, // ./ 相对路径
        { baseURL: "https://example.com/path/", relativePath: "page.html", expected: "https://example.com/path/page.html" },      // 没有 ./ 或 ../ 的相对路径
        { baseURL: "https://example.com/path", relativePath: "page.html", expected: "https://example.com/page.html" },  //baseURL不以/结尾
        { baseURL: "https://example.com/", relativePath: "page.html", expected: "https://example.com/page.html" },      // baseURL以/结尾
        { baseURL: "https://example.com", relativePath: "/page.html", expected: "https://example.com/page.html" },//以 / 开头的相对路径
        // 更多特殊字符
        { baseURL: "https://example.com", relativePath: "page[1].html", expected: "https://example.com/page[1].html" }, // 包含 []
        // 更多 Unicode 字符
        { baseURL: "https://example.com", relativePath: "página.html", expected: "https://example.com/p%C3%A1gina.html" }, // 西班牙语
        { baseURL: "https://example.com", relativePath: "страница.html", expected: "https://example.com/%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0.html" }, // 俄语
        // 空路径和空白路径
        { baseURL: "https://example.com", relativePath: "", expected: "https://example.com/" },
        { baseURL: "https://example.com", relativePath: "   ", expected: "https://example.com/" },
    ];


    testCases.forEach(({ baseURL, relativePath, expected }) => {
        it(`getAbsoluteURL with baseURL: ${baseURL}, relativePath: ${relativePath}`, () => {
            // 在每个测试用例开始前清除 logger.error 的调用记录
            (logger.error as jest.Mock).mockClear();
            // 测试 NetworkUtils.getAbsoluteURL。  baseURL 可能是 undefined, 但不应传入 null
            expect(NetworkUtils.getAbsoluteURL(baseURL === null ? undefined : baseURL, relativePath)).toBe(expected);

        });
    });

    it('should log an error for invalid baseURL', () => {
        (logger.error as jest.Mock).mockClear();
        const baseURL = 'invalid url';
        const relativePath = 'page.html';

        NetworkUtils.getAbsoluteURL(baseURL, relativePath);

        const calls = (logger.error as jest.Mock).mock.calls;
        expect(calls.length).toBe(1);


        expect(calls[0][0]).toBe("[NetworkUtils2] 网址拼接出错:");  //NetworkUtils2 -> NetworkUtils
        expect(calls[0][1]).toMatchObject({
            baseURL: baseURL,
            relativePath: relativePath,
            error: expect.anything(), // 使用 expect.anything()
            stack: expect.any(String)
        });
    });

    it('should not log an error for invalid URL combination, but return a default URL', () => {
        (logger.error as jest.Mock).mockClear();

        const baseURL = 'https://example.com';
        const relativePath = String.fromCharCode(0x01);  // Control character
        const expected = "https://example.com/";

        expect(NetworkUtils.getAbsoluteURL(baseURL, relativePath)).toBe(expected);

        const calls = (logger.error as jest.Mock).mock.calls;
        expect(calls.length).toBe(0); // 不应该调用 logger.error
    });

    describe('getBaseUrl', () => {

        const baseUrlTestCases = [
            { url: "https://www.example.com", expected: "https://www.example.com" },
            { url: "http://www.example.com/path?query=1", expected: "http://www.example.com" },
            { url: "https://www.example.com/path#fragment", expected: "https://www.example.com" },
            { url: "http://user:pass@example.com", expected: "http://user:pass@example.com" },
            { url: "example.com", expected: null },
            { url: "example.com/path", expected: null }, // 修改为 null
            { url: "example.com/path?query=1", expected: null }, // 修改为 null
            { url: "example.com/path#fragment", expected: null }, // 修改为 null
            { url: "http://192.168.1.1", expected: "http://192.168.1.1" },
            { url: "http://192.168.1.1/path", expected: "http://192.168.1.1" },
            { url: "/path/to/resource", expected: null }, // 修改为 null
            { url: "//path/to/resource", expected: null },  //修改为 null
            { url: null, expected: null },
            { url: "", expected: null },
            { url: 'https://example.com:8080', expected: 'https://example.com:8080' },
            // 更多不同格式的 URL
            { url: "https://example.com/path/to/page.html?param1=value1¶m2=value2#section1", expected: "https://example.com" },
            { url: "http://[::1]", expected: "http://[::1]" },
            { url: "http://[::1]/path", expected: "http://[::1]" },
            { url: "file:///path/to/file.txt", expected: null },

        ];


        baseUrlTestCases.forEach(({ url, expected }) => {
            it(`getBaseUrl with url: ${url} for NetworkUtils`, () => {
                // 在每个测试用例开始前清除 logger.error 的调用记录
                (logger.error as jest.Mock).mockClear();
                expect(NetworkUtils.getBaseUrl(url)).toBe(expected);
            });
        });
    });

    describe('isFullyUrlEncoded', () => {
        const isFullyUrlEncodedTestCases = [
            { str: "abcdefg", expected: true },       // 完全不需要编码
            { str: "a%20b%20c", expected: true },   // 已完全编码
            { str: "a b c", expected: false },      // 空格需要编码
            { str: "a%20b c", expected: false },     // 部分编码，但仍有空格
            { str: "你好世界", expected: false },      // 中文需要编码
            { str: "こんにちは世界", expected: false },      // 日文需要编码
            { str: "", expected: true },          // 空字符串不需要编码
            { str: "https://www.example.com/path%20with%20spaces", expected: false }, // 仍有空格
            { str: "https%3A%2F%2Fwww.example.com%2Fpath%20with%20spaces", expected: true },//仍有空格
            { str: "https://www.example.com/你好世界", expected: false },   // 中文
            { str: "https%3A%2F%2Fwww.example.com%2F%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C", expected: true },  // 已完全编码
            { str: "a%2b", expected: true },       // '+' 需要被编码 (在某些情况下，例如 query string). 现在的 isFullyUrlEncoded 认为它不需要。
            { str: "a%2B", expected: true },       //  "%" 后面跟的不是两个有效的Hex
            { str: "a%2Bb", expected: true },      //  %2B 是 + 的编码
            { str: "%", expected: false },         // 无效编码
            { str: "%zz", expected: false },       // 无效编码
            { str: "a+b", expected: true },      // + 需要编码 (在某些情况下).
            { str: "$-_.+!*'(),", expected: false },  // 一些RFC3986允许的字符,在某些场景也需要编码
            { str: "%24%2D%5F%2E%2B%21%2A%27%28%29%2C", expected: true },

            // URL 不同部分的编码
            { str: "http://example.com", expected: false }, // 协议和主机不需要编码
            { str: "http://example.com/path with spaces", expected: false },  // 路径需要编码
            { str: "http://example.com/path%20with%20spaces", expected: false },
            { str: "http://example.com?param=value with spaces", expected: false },   // 查询参数需要编码
            { str: "http://example.com?param=value%20with%20spaces", expected: false },
            { str: "http://example.com#fragment with spaces", expected: false }, // 片段标识符理论上不需要编码，但实际应用中可能会
            { str: "http://example.com#fragment%20with%20spaces", expected: false },
            // 百分号编码的各种情况
            { str: "%20", expected: true },    // 空格
            { str: "%25", expected: true },   // 百分号本身
            { str: "%zz", expected: false },   // 无效的百分号编码
            { str: "a%2", expected: false },   // 不完整的百分号编码
            { str: "%e4%bd%a0%e5%a5%bd", expected: true },  //你好

        ];



        isFullyUrlEncodedTestCases.forEach(({ str, expected }) => {
            it(`isFullyUrlEncoded with str: ${str}`, () => {
                // 在每个测试用例开始前清除 logger.error 的调用记录
                (logger.error as jest.Mock).mockClear();
                expect(NetworkUtils.isFullyUrlEncoded(str)).toBe(expected);
            });
        });

    });
});
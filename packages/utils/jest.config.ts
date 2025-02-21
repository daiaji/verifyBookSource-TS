// jest.config.ts
import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        "**/__tests__/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test).[jt]s?(x)"
    ],
    extensionsToTreatAsEsm: ['.ts', '.tsx'], // 明确指定 .ts 和 .tsx 为 ESM
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'], // 确保包含所有相关文件扩展名
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
                useESM: true, // 明确告诉 ts-jest 使用 ESM
            },
        ],
    },
    // 注意: 如果你的项目使用了 tsconfig-paths 来处理路径别名，
    // 你可能还需要配置 moduleNameMapper，但在这个例子中应该不需要。
};

export default jestConfig;
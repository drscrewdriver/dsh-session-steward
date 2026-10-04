import { defineConfig } from 'tsdown'

// 客户端模块表中 shell 共享的平台模块，打包时保持 external 由 loader 的 require 解析。
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
]

const ID = 'dsh-session-steward'

export default defineConfig([
  // 主机半身：src/index.ts 产出 lib/index.js（ESM / node）。
  // 宿主半拆成两个单入口构建:codeSplitting:false 时 rolldown 不允许多输入,
  // 而多入口共享模块会拆出 chunk 文件 —— files 白名单与部分加载器对多文件
  // 产物都更脆弱(beta.10 的 chunk 漏发事故)。各入口自包含,重复内联共享模块。
  ...([
    { libName: 'index', entryPath: 'src/index.ts', withDts: true },
    { libName: 'registry', entryPath: 'src/host/registry/archive-registry.ts', withDts: false },
  ]).map(spec => ({
    name: `${ID}/lib/${spec.libName}`,
    entry: { [spec.libName]: spec.entryPath },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    outputOptions: { codeSplitting: false },
    // 产出 lib/index.js / lib/index.d.ts（非 .mjs/.d.mts），main/types 解析无需处理扩展名。
    fixedExtension: false,
    dts: spec.withDts,
    clean: false,
    // 框架依赖由 dsh profile 树在运行时解析；@deepseek-ai/dsh-session 仅在可用时软加载。
    deps: {
      neverBundle: [
        /^node:/,
        '@deepseek-ai/cordis',
        '@deepseek-ai/schemastery',
        '@deepseek-ai/dsh-session',
        // P1 服务替换的宿主包:运行时由 profile 树解析（枚举 peer）。
        '@deepseek-ai/dsh-workspace',
        '@deepseek-ai/dsh-spill-local',
        // 可选加速驱动（optionalDependencies）：缺失时引擎回退 node:sqlite，
        // 打包器绝不能尝试解析它。
        'better-sqlite3',
      ],
    },
  })),
  // 浏览器半身：src/client/index.ts 产出 lib/client.js（ModuleLoader 工厂）。
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])

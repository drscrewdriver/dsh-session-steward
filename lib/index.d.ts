//#region node_modules/.pnpm/cosmokit@1.8.1/node_modules/cosmokit/lib/index.d.ts
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
type Promisify<T> = Promise<T extends Promise<infer S> ? S : T>;
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>;
//#endregion
//#region node_modules/.pnpm/@standard-schema+spec@1.1.0/node_modules/@standard-schema/spec/dist/index.d.ts
/** The Standard Typed interface. This is a base type extended by other specs. */
interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
declare namespace StandardTypedV1 {
  /** The Standard Typed properties interface. */
  interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }
  /** The Standard Typed types interface. */
  interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }
  /** Infers the input type of a Standard Typed. */
  type InferInput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  /** Infers the output type of a Standard Typed. */
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}
/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: StandardSchemaV1.Options | undefined) => Result<Output> | Promise<Result<Output>>;
  }
  /** The result interface of the validate function. */
  type Result<Output> = SuccessResult<Output> | FailureResult;
  /** The result interface if validation succeeds. */
  interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }
  interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  /** The result interface if validation fails. */
  interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }
  /** The issue interface of the failure output. */
  interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  /** The path segment interface of the issue. */
  interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }
  /** The Standard types interface. */
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  /** Infers the input type of a Standard. */
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  /** Infers the output type of a Standard. */
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/utils.d.ts
declare class DisposableList<T extends WeakKey> {
  private sn;
  private map;
  private weak;
  get length(): number;
  push(value: T): () => boolean;
  delete(value: T): boolean;
  clear(): T[];
  [Symbol.iterator](): MapIterator<T>;
}
declare const symbols: {
  shadow: symbol;
  caller: symbol;
  receiver: symbol;
  original: symbol;
  metadata: symbol;
  initHooks: symbol;
  checkProto: symbol;
  effect: typeof Context.effect;
  filter: typeof Context.filter;
  isolate: typeof Context.isolate;
  intercept: typeof Context.intercept;
  init: typeof Service.init;
  check: typeof Service.check;
  config: typeof Service.config;
  invoke: typeof Service.invoke;
  extend: typeof Service.extend;
  tracker: typeof Service.tracker;
  resolveConfig: typeof Service.resolveConfig;
};
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/registry.d.ts
type Inject<M = Dict> = (keyof M)[] | { [K in keyof M]?: M[K]; };
type InjectKey = keyof { [K in keyof Context & string as Context[K] extends {
  [symbols.config]: any;
} ? K : never]: any; };
declare function Inject<K extends InjectKey>(name: K, config?: Context[K] extends {
  [symbols.config]: infer T;
} ? T : never): (value: any, decorator: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any>) => void;
declare namespace Inject {
  function resolve(inject: Inject | null | undefined, result?: Dict): Dict;
}
type Plugin<T = any> = Plugin.Function<T> | Plugin.Constructor<T> | Plugin.Object<T>;
declare namespace Plugin {
  interface Base<T = any> {
    name?: string;
    Config?: StandardSchemaV1<any, T>;
    inject?: Inject;
    provide?: string | string[];
    intercept?: Dict<boolean>;
  }
  interface Transform<S, T> {
    schema?: true;
    Config: (config: S) => T;
  }
  interface Function<T = any> extends Base<T> {
    (ctx: Context, config: T): any;
  }
  interface Constructor<T = any> extends Base<T> {
    new (ctx: Context, config: T): any;
  }
  interface Object<T = any> extends Base<T> {
    apply(ctx: Context, config: T): any;
  }
  interface Runtime {
    name?: string;
    fibers: DisposableList<Fiber>;
    callback: globalThis.Function;
    Config?: StandardSchemaV1;
  }
}
type Spread<T> = undefined extends T ? [config?: T] : [config: T];
type GetPluginParameters<P> = P extends ((ctx: Context, ...args: infer R) => any) ? R : P extends (new (ctx: Context, ...args: infer R) => any) ? R : P extends {
  apply(ctx: Context, ...args: infer R): any;
} ? R : never;
type GetPluginConfig<P> = P extends Plugin.Transform<infer S, any> ? S : GetPluginParameters<P>[0];
declare module './context' {
  interface Context {
    inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
    plugin<P extends Plugin>(plugin: P, ...args: Spread<GetPluginConfig<P>>): Fiber & PromiseLike<Fiber>;
  }
}
declare class RegistryService {
  ctx: Context;
  private _counter;
  private _internal;
  constructor(ctx: Context);
  get counter(): number;
  get size(): number;
  resolve(plugin: Plugin): Function | undefined;
  get(plugin: Plugin): Plugin.Runtime | undefined;
  has(plugin: Plugin): boolean;
  delete(plugin: Plugin): Plugin.Runtime | undefined;
  keys(): MapIterator<Function>;
  values(): MapIterator<Plugin.Runtime>;
  entries(): MapIterator<[Function, Plugin.Runtime]>;
  forEach(callback: (value: Plugin.Runtime, key: Function) => void): void;
  inject(inject: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
  plugin(plugin: Plugin, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/reflect.d.ts
declare module './context' {
  interface Context {
    get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K];
    get(name: string, strict?: boolean): any;
    set<K extends string & keyof this>(name: K, value: undefined | this[K]): void;
    set(name: string, value: any): void;
    provide<K extends string & keyof this>(name: K, value: undefined | this[K]): () => void;
    provide(name: string, value?: any): () => void;
    accessor(name: string, options: Omit<Property.Accessor, 'type'>): void;
    mixin<K extends string & keyof this>(name: K, mixins: (keyof this & keyof this[K])[] | Dict<string>): void;
    mixin<T extends {}>(source: T, mixins: (keyof this & keyof T)[] | Dict<string>): void;
  }
}
type Property = Property.Service | Property.Accessor;
declare namespace Property {
  interface Service {
    type: 'service';
  }
  interface Accessor {
    type: 'accessor';
    get: (this: Context, receiver: any, error: Error) => any;
    set?: (this: Context, value: any, receiver: any, error: Error) => boolean;
  }
}
interface Impl {
  name: string;
  fiber: Fiber;
  value?: any;
  check?: () => boolean;
}
declare class ReflectService {
  ctx: Context;
  static handler: ProxyHandler<Context>;
  store: Dict<Impl, symbol>;
  props: Dict<Property>;
  constructor(ctx: Context);
  get(name: string, strict?: boolean): any;
  _getImpl(name: string, strict?: boolean): Impl | undefined;
  set(name: string, value: any, error?: Error): boolean;
  provide(name: string, value?: any, check?: () => boolean): Disposable<Promise<void>>;
  notify(names: string[], filter?: (ctx: Context, name: string) => boolean): Fiber[];
  accessor(name: string, options: Omit<Property.Accessor, 'type'>): Disposable<Promise<void>>;
  mixin(source: any, mixins: string[] | Dict<string>): Disposable<Promise<void>>;
  trace<T>(value: T): T;
  bind<T extends Function>(callback: T): T;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/fiber.d.ts
declare module './context' {
  interface Context extends Pick<Fiber, 'effect'> {
    fiber: Fiber;
  }
}
interface AsyncDisposable<T extends Awaitable<void> = Awaitable<void>> extends PromiseLike<() => T> {
  (): T;
}
type Disposable<T = any> = () => T;
type Effect<T = any> = SyncEffect<T> | AsyncEffect<T>;
type SyncEffect<T = any> = Disposable<T> | Iterable<Disposable<T>, void, void>;
type AsyncEffect<T = any> = Promise<Disposable<T>> | AsyncIterable<Disposable<T>, void, void>;
interface EffectMeta {
  label: string;
  children: EffectMeta[];
}
declare const enum FiberState {
  PENDING = 0,
  LOADING = 1,
  ACTIVE = 2,
  FAILED = 3,
  DISPOSED = 4,
  UNLOADING = 5
}
declare class Fiber {
  parent: Context;
  inject: Dict<any>;
  runtime: Plugin.Runtime | null;
  uid: number | null;
  readonly ctx: Context;
  config: any;
  state: FiberState;
  readonly dispose: () => Promise<void>;
  store: Dict<Impl> | undefined;
  inertia: Promise<void> | undefined;
  readonly _hooks: Dict<DisposableList<Function>>;
  readonly _disposables: DisposableList<Disposable<any>>;
  protected context: Context;
  private _error;
  private _runner;
  private _store;
  constructor(parent: Context, config: any, inject: Dict<any>, runtime: Plugin.Runtime | null, getOuterStack: () => string[]);
  get name(): string;
  assertActive(): void;
  private _execute;
  effect(execute: () => SyncEffect, label?: string): Disposable<Promise<void>>;
  effect(execute: () => Effect, label?: string): AsyncDisposable<Promise<void>>;
  getEffects(): EffectMeta[];
  private _getState;
  private _updateState;
  _checkImpl(name: string): boolean | undefined;
  _refresh(): void;
  private _setEpoch;
  private _reload;
  private _unload;
  await(): Promise<this>;
  restart(): Promise<void>;
  update(config: any, noSave?: boolean): Awaitable<void>;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/events.d.ts
type Parameters<F> = F extends ((...args: infer P) => any) ? P : never;
type ReturnType<F> = F extends ((...args: any) => infer R) ? R : never;
type ThisType<F> = F extends ((this: infer T, ...args: any) => any) ? T : never;
type DispatchMode = 'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall';
declare module './context' {
  interface Context {
    parallel<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): Promise<void>;
    parallel<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): Promise<void>;
    emit<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): void;
    emit<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): void;
    serial<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType<Events[K]>>;
    serial<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType<Events[K]>>;
    bail<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>;
    bail<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>;
    waterfall<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>;
    waterfall<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>;
    on<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
    once<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
  }
}
interface EventOptions {
  prepend?: boolean;
  global?: boolean;
}
interface Hook extends EventOptions {
  ctx: Context;
  callback: (...args: any[]) => any;
}
declare class EventsService {
  private ctx;
  _hooks: Record<keyof any, Hook[]>;
  constructor(ctx: Context);
  private _resolve;
  /** @deprecated */
  dispatch(type: string, args: any[]): ((...args: any[]) => any)[];
  parallel(...args: any[]): Promise<void>;
  emit(...args: any[]): void;
  serial(...args: any[]): Promise<any>;
  bail(...args: any[]): any;
  waterfall(...args: any[]): any;
  private register;
  private unregister;
  on(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
  once(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
}
interface Events {
  [key: symbol]: (...args: any[]) => any;
  'internal/plugin'(fiber: Fiber): void;
  'internal/status'(fiber: Fiber, oldValue: FiberState): void;
  'internal/service'(this: Context, name: string, value: any): void;
  'internal/update'(this: Fiber, config: any, noSave: boolean, next: () => Awaitable<void>): Awaitable<void>;
  'internal/get'(ctx: Context, name: string, error: Error, next: () => any): any;
  'internal/set'(ctx: Context, name: string, value: any, error: Error, next: () => boolean): boolean;
  'internal/listener'(this: Context, name: string, listener: any, prepend: boolean): void;
  'internal/dispatch'(mode: DispatchMode, name: string | symbol, args: any[], thisArg: any): void;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/logger.d.ts
declare module './context' {
  interface Intercept {
    logger: LoggerService.Intercept;
  }
}
type LoggerType = 'error' | 'info' | 'warn' | 'debug';
type LoggerMethod = (format: any, ...param: any[]) => void;
type Formatter = (value: any, exporter: Exporter, message: Message) => any;
interface Message {
  sn: number;
  ts: number;
  name: string;
  type: LoggerType;
  level: number;
  args: any[];
  fiber?: WeakRef<Fiber>;
}
interface Exporter {
  colors?: number | false;
  maxLength?: number;
  levels?: Record<string, number>;
  formatters?: Record<string, Formatter>;
  export(message: Message): void;
}
interface LoggerOptions {
  name: string;
  meta?: Partial<Message>;
  level?: number;
}
interface Logger extends LoggerOptions {}
interface Logger extends Record<LoggerType, LoggerMethod> {}
declare class Logger {
  private service;
  static color(exporter: Exporter, code: number, value: any, decoration?: string): string;
  static code(name: string, level?: false | number): number;
  static format(exporter: Exporter, message: Message): string;
  constructor(options: LoggerOptions, service: LoggerService);
  private _method;
}
declare namespace LoggerService {
  interface Intercept {
    name?: string;
    level?: number;
  }
}
interface LoggerService extends Record<LoggerType, LoggerMethod> {
  (name?: string): Logger;
}
declare class LoggerService {
  bufferSize: number;
  buffer: Message[];
  ctx: Context;
  _snMessage: number;
  _snExporter: number;
  exporters: Map<number, Exporter>;
  constructor(ctx: Context);
  exporter(exporter: Exporter): Disposable<Promise<void>>;
  private _resolveConfig;
  [symbols.invoke](name?: string): Logger;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/context.d.ts
interface Context {
  [symbols.isolate]: Dict<symbol>;
  [symbols.intercept]: Dict;
  /** @experimental */
  root: this;
  baseUrl?: string | undefined;
  events: EventsService;
  logger: LoggerService;
  reflect: ReflectService;
  registry: RegistryService;
}
declare class Context {
  static readonly effect: unique symbol;
  static readonly filter: unique symbol;
  static readonly isolate: unique symbol;
  static readonly intercept: unique symbol;
  static is(value: any): value is Context;
  constructor();
  extend(meta?: {}): this;
  isolate(name: string, label?: symbol): this;
  intercept<K extends InjectKey>(name: K, config: Context[K] extends {
    [symbols.config]: infer T;
  } ? T : never): this;
  intercept(name: string, config: any): this;
}
//#endregion
//#region node_modules/.pnpm/cordis@4.0.0-rc.10/node_modules/cordis/lib/service.d.ts
declare abstract class Service<out T = never> {
  protected ctx: Context;
  static readonly init: unique symbol;
  static readonly check: unique symbol;
  static readonly config: unique symbol;
  static readonly invoke: unique symbol;
  static readonly extend: unique symbol;
  static readonly tracker: unique symbol;
  static readonly resolveConfig: unique symbol;
  [symbols.config]: T;
  name: string;
  constructor(ctx: Context, name: string);
  protected [symbols.filter](ctx: Context): boolean;
  protected [symbols.extend](props?: any): any;
  [symbols.resolveConfig](base?: T, head?: T): T;
  static [Symbol.hasInstance](instance: any): boolean;
}
//#endregion
//#region src/config.d.ts
/**
 * dsh-session-steward 的共享配置面。
 *
 * 与 host 半身（schemastery schema 在 src/index.ts）以及浏览器半身共用同一形状，
 * 使一处 admitted 的值在另一处也 admitted —— 与 dsh-session-search-toggle /
 * dsh-thinking-levels 的 config 面惯例一致。
 */
/** 会话管家运行时配置（设置命名空间 + 组合入口）。 */
interface StewardConfig {
  /** 插件总开关。 */
  enabled: boolean;
  /** 会话历史文件（归档浏览与清理）。关闭后不注册 history 路由、不渲染「病案室」页签。 */
  historyFiles?: boolean;
  /** 会话健康检查（体检 → 处方 → 出院）。关闭后不注册 health 路由、不渲染「体检」页签。 */
  healthCheck?: boolean;
}
/** 缺省值。 */
declare const DEFAULT_CONFIG: Required<StewardConfig>;
/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
declare const STEWARD_SETTINGS_NAMESPACE = "session-steward";
/** host 路由前缀（与搜索索引插件的 /switch-search/api 互不干扰）。 */
declare const STEWARD_API_PREFIX = "/session-steward/api";
//#endregion
//#region src/host/history/archive-source.d.ts
/** 一次归档读取的结果：ids 以及服务它的来源。 */
interface StewardArchiveRead {
  ids: readonly string[];
  source: 'registry' | 'storage-file' | 'none';
}
/** workspaceRegistry 镜像面（只读 getter）。 */
interface StewardRegistryFace {
  readonly archivedSessionIds: readonly string[];
}
/**
 * 解析一次官方归档集合。
 * @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
 * @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
 * @returns 归档 ids 以及服务它的来源。
 */
declare function readArchiveSet(registry?: StewardRegistryFace, searchPaths?: readonly string[]): StewardArchiveRead;
/**
 * 从存储中枢的 global.archivedSessionIds 中移除会话 id。
 *
 * 官方后端没有 unarchive 端点，因此直接编辑规范文件，遵循 storage-json 自身的协议：
 * 备份、同目录临时写入、改名。运行中的宿主把集合留在内存里、只在启动时重载 ——
 * 调用方必须提示需要重启 DSH。
 * @param ids - 要从归档数组中移除的会话 id。
 * @param log - 可选日志出口。
 * @param searchPaths - 可选候选路径覆盖（测试注入用）。
 * @returns 实际移除数量与剩余数量。
 */
declare function pruneArchiveFile(ids: readonly string[], log?: (msg: string) => void, searchPaths?: readonly string[]): {
  removed: number;
  remaining: number;
  file?: string;
};
//#endregion
//#region src/host/history/archive.d.ts
/** 一行历史文件条目（尽力而为的元数据）。 */
interface StewardHistoryRow {
  sessionId: string;
  title: string;
  cwd: string;
  updatedAt: number;
}
/** 列表结果。 */
interface StewardHistoryListResult {
  ok: boolean;
  items?: StewardHistoryRow[];
  /** 归档集合来源；`none` 表示两处都没读到。 */
  source?: 'registry' | 'storage-file' | 'none';
  /** 元数据降级原因（标题/cwd 缺失时给出）。 */
  degraded?: string;
  error?: string;
}
/** 标题快照读取面（结构化镜像，零 value import）。 */
interface StewardTitleQueryFace {
  readTitleSnapshots?(ids: readonly string[]): Promise<readonly {
    status: 'fulfilled' | 'rejected';
    value?: {
      title?: {
        title: string;
      };
    };
  }[]>;
}
/**
 * `session-history-list`：列出官方归档集合（尽力附带标题等元数据）。
 * @param getRegistry - 惰性 workspaceRegistry 面。
 * @param query - 可选标题快照面。
 * @param searchPaths - 可选存储文件候选路径（DSH_HOME 非默认值/测试注入）。
 * @returns 归档行清单。
 */
declare function listHistory(getRegistry: () => StewardRegistryFace | undefined, query?: StewardTitleQueryFace, searchPaths?: readonly string[]): Promise<StewardHistoryListResult>;
/** 清理结果。 */
interface StewardHistoryPruneResult {
  ok: boolean;
  removed?: number;
  remaining?: number;
  requiresRestart?: boolean;
  error?: string;
}
/**
 * `session-history-prune`：从官方归档数组中批量移除会话 id。
 * 行为与迁移前等价：校验入参 → 备份并原子替换存储文件 → 返回 removed/remaining，
 * 并明确要求重启 DSH（宿主内存中的集合只在启动时重载）。
 * @param payload - `{ sessionIds: string[] }`。
 * @param log - 可选日志出口。
 * @param searchPaths - 可选候选路径覆盖（测试注入用）。
 */
declare function pruneHistory(payload: unknown, log?: (msg: string) => void, searchPaths?: readonly string[]): StewardHistoryPruneResult;
//#endregion
//#region src/host/health/decode.d.ts
/** 一次读取的统计与问题清单。 */
interface SessionLogRead {
  events: DecodedEvent[];
  /** 完整帧数。 */
  frames: number;
  /** 撕裂尾帧起始偏移（无撕裂为 undefined）。 */
  tornStart?: number;
  /** 从撕裂尾帧抢救出的明文字节数。 */
  recoveredFromTorn: number;
  /** 读取问题（解码失败/seq 缺口），按遇到顺序。 */
  issues: {
    line: number;
    why: string;
  }[];
  /** 实际使用的解码器来源。 */
  decoder: 'official' | 'local';
  /** 尾部是否仍有未收尾的 open step。 */
  openStep?: {
    turn: number;
    step: number;
  };
}
/** 解码后的事件（结构子集）。 */
interface DecodedEvent {
  type: string;
  seq: number;
  time: number;
  data?: Record<string, unknown>;
  surfaceOp?: 'append' | {
    op: 'replace';
    start: number;
    end: number;
  };
  sourceEventSeqs?: number[];
}
/** 扫描拼接的 zstd 多帧；返回完整帧范围与撕裂尾帧起点。 */
declare function scanZstdFrames(buffer: Buffer): {
  frames: {
    start: number;
    end: number;
  }[];
  tornStart?: number;
};
/** 官方解码器面（软加载所得）。 */
interface OfficialDecoders {
  decodeStorageRecord(value: unknown): DecodedEvent[];
  decodeSeqRanges(value: unknown, seq: number): number[];
}
/**
 * 读取一个会话日志文件（zip 帧扫描 + 解包 + seq 连续性）。
 * @param file - `session.jsonl.zstd` 绝对路径。
 * @param bytes - 文件内容（调用方读取，便于测试注入）。
 * @param decoders - 可选官方解码器（缺省用本地等价实现）。
 * @returns 事件、统计与问题清单。
 */
declare function decodeSessionLogBytes(file: string, bytes: Buffer, decoders?: OfficialDecoders): SessionLogRead;
/** 从文件读取并解码。 */
declare function decodeSessionLogFile(file: string, decoders?: OfficialDecoders): SessionLogRead;
//#endregion
//#region src/host/health/gates.d.ts
/** gate 严重级。 */
type GateLevel = 'ok' | 'warn' | 'fail';
/** 归属信息：把失败字段指回具体插件包与字段路径。 */
interface GateAttribution {
  /** 投影 key（例如 liveTokenStats）。 */
  projection?: string;
  /** 所属包名；无法判定时为 'unknown'。 */
  package?: string;
  /** 违规字段路径。 */
  field?: string;
}
/** 一个 gate 的结果。 */
interface GateResult {
  id: 'log-integrity' | 'projection-cache' | 'lossless-json' | 'cold-read';
  level: GateLevel;
  evidence: string;
  attribution?: GateAttribution;
  detail?: Record<string, unknown>;
}
/** 单会话体检报告。 */
interface SessionHealthReport {
  sessionId: string;
  level: GateLevel;
  gates: GateResult[];
  generatedAt: number;
}
/** gate 输入。 */
interface GateContext {
  sessionId: string;
  /** DSH home（缺省 ~/.dsh）。 */
  dshHome?: string;
  /** 会话日志路径；缺省由调用方解析后传入。 */
  logPath?: string;
  /** 已解码的日志（复用，避免重复解码）。 */
  log?: SessionLogRead;
  /** 热态：宿主 `sessionProjections.checkpoint(session)` 的逐行状态。 */
  projectionState?: Record<string, unknown>;
  /** 归属查询函数（投影 key → 包名）。 */
  attribute?: (projection: string) => GateAttribution | undefined;
  /** 时间源（测试可控）。 */
  now?: () => number;
}
/** 由日志读取结果推导的尾部事实。 */
interface TailFacts {
  lastSeq: number;
  lastEventType: string;
  lastTurnEnd?: {
    turn: number;
    reason: string;
  };
  openStep?: {
    turn: number;
    step: number;
  };
  assistantAfterLastUser: boolean;
}
/** 从解码事件推导尾部事实。 */
declare function readTailFacts(log: SessionLogRead): TailFacts;
/** gate 1：日志完整性（可解码、seq 连续、无撕裂尾帧）。 */
declare function gateLogIntegrity(log: SessionLogRead): GateResult;
/** 投影缓存行的体检事实。 */
interface ProjectionCacheFacts {
  present: boolean;
  path: string;
  cacheSeq?: number;
  rows?: number;
  lag?: number;
  unsettled: string[];
  error?: string;
}
/** 读取投影缓存记录并计算滞后与未结算字段。 */
declare function readProjectionCache(sessionId: string, logLastSeq: number, dshHome?: string): ProjectionCacheFacts;
/** gate 2：投影缓存水位与结算形态。 */
declare function gateProjectionCache(facts: ProjectionCacheFacts): GateResult;
/** gate 3：投影状态的无损 JSON 判定（本次事故核心）。 */
declare function gateLosslessJson(projectionState: Record<string, unknown> | undefined, attribute?: (projection: string) => GateAttribution | undefined): GateResult;
/** gate 4：冷读成本与可接续性。 */
declare function gateColdRead(facts: TailFacts): GateResult;
/** 聚合四门结果为一份报告。 */
declare function buildSessionReport(context: GateContext): SessionHealthReport;
//#endregion
//#region src/host/health/lossless.d.ts
/**
 * 无损 JSON 判定 —— 本次事故的核心 gate 判据。
 *
 * 判定口径与宿主 `@deepseek-ai/dsh-util-values` 的 `isJsonValue` 一致：
 * 普通（或 null）原型的对象、可枚举的字符串键、有限数（含拒绝 -0）、非稀疏数组、
 * 无环；undefined / NaN / ±Infinity / 函数 / Symbol / BigInt 一律视为不可无损序列化。
 *
 * 通过宿主 `assertJsonArgs` / 投影缓存写入的数据都会先过这道口径，所以投影**状态**
 * 一旦含上述值，`api-session/added` 推送与检查点写入都会失败（症状错位的根因）。
 */
/** 首个违规点位。 */
interface LosslessViolation {
  /** 到违规值的属性路径，例如 `.activeStep.lastSettled.actualTokens`。 */
  path: string;
  /** 违规原因的可读描述。 */
  reason: 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0' | 'function' | 'symbol' | 'bigint' | 'sparse-array-hole' | 'non-plain-prototype' | 'non-enumerable-or-symbol-key' | 'cycle';
  /** 违规处的实际类型（便于人工核对）。 */
  actual: string;
}
/** 单个值是否可无损 JSON 序列化。 */
declare function isLossless(value: unknown): boolean;
/**
 * 找出第一个破坏无损 JSON 的值；全部合规时返回 undefined。
 * @param value - 待判定的值（通常是投影状态）。
 * @param limit - 最多访问的节点数（防御超大对象）。
 * @returns 首个违规点位或 undefined。
 */
declare function firstLosslessViolation(value: unknown, limit?: number): LosslessViolation | undefined;
//#endregion
//#region src/host/health/attribution.d.ts
/** 一条归属记录。 */
interface ProjectionOwner {
  key: string;
  /** 包名；内置包以 `@deepseek-ai/` 前缀判定。 */
  package: string;
  /** 'core' 表示内置包，'plugin' 表示第三方插件。 */
  kind: 'core' | 'plugin';
  /** 命中文件（相对 node_modules）。 */
  entry: string;
}
/**
 * 建立投影 key → 包 的索引。
 * @param nodeModulesRoot - profile 的 node_modules 根。
 * @returns 归属记录（同一 key 多包命中时保留首个并排序稳定）。
 */
declare function buildProjectionOwnerIndex(nodeModulesRoot: string): ProjectionOwner[];
/** 索引查询器。 */
declare function createAttributor(index: readonly ProjectionOwner[]): (projection: string) => GateAttribution | undefined;
//#endregion
//#region src/host/health/repair.d.ts
/** 可逆处置的结果。 */
interface RepairOutcome {
  ok: boolean;
  action: 'quarantine-projection-cache';
  sessionId: string;
  /** 原路径。 */
  from: string;
  /** 隔离后的路径（即备份）。 */
  to?: string;
  /** 需要用户执行的动作说明。 */
  requiresRestart?: boolean;
  error?: string;
}
/**
 * 隔离一个会话的投影缓存记录（备份 = 移动本身，可原样搬回）。
 * @param sessionId - 会话 id。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 * @param now - 时间源（测试可控）。
 */
declare function quarantineProjectionCache(sessionId: string, dshHome?: string, now?: () => number): RepairOutcome;
/**
 * 依据体检报告给出「处方」（命令清单）。
 * @param report - 体检报告。
 * @param dshHome - DSH home（用于生成路径提示）。
 * @returns 可复制执行的命令与人读说明。
 */
declare function prescribe(report: SessionHealthReport, dshHome?: string): string[];
//#endregion
//#region src/host/health/scan.d.ts
/** 一个已发现的会话日志。 */
interface DiscoveredSession {
  sessionId: string;
  logPath: string;
  updatedAt: number;
  bytes: number;
}
/** 枚举全部会话日志（按 mtime 倒序），带可选上限。 */
declare function discoverSessions(dshHome?: string, limit?: number): DiscoveredSession[];
/** 定位一个会话的日志路径（跨工程目录查找）。 */
declare function findSessionLog(sessionId: string, dshHome?: string): string | undefined;
/** 扫描结果。 */
interface HealthScanResult {
  ok: boolean;
  scanned: number;
  findings: SessionHealthReport[];
  /** 仅保留非 ok 的报告时使用。 */
  filtered?: boolean;
  error?: string;
}
/**
 * 批量体检。
 * @param options - dshHome / 扫描上限 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
 */
declare function scanSessions(options: {
  dshHome?: string;
  limit?: number;
  onlyProblems?: boolean;
  attribute?: GateContext['attribute'];
  projectionStateFor?: (sessionId: string) => Record<string, unknown> | undefined;
  now?: () => number;
}): HealthScanResult;
//#endregion
//#region src/index.d.ts
/** 本插件声明的宿主服务（与 toggle 相同的注入面）。 */
declare const inject: string[];
/** 运行时依赖。 */
interface StewardRuntime {
  config: () => Required<StewardConfig>;
  dshHome: string;
  registry: () => StewardRegistryFace | undefined;
  projectionStateFor: (sessionId: string) => Record<string, unknown> | undefined;
  attribute: (projection: string) => {
    projection?: string;
    package?: string;
    field?: string;
  } | undefined;
  log: (message: string) => void;
}
/** 支持的路由方法（按子域分组；用于对外声明与测试断言）。 */
declare const HISTORY_METHODS: readonly ["session-history-list", "session-history-prune"];
declare const HEALTH_METHODS: readonly ["session-health-status", "session-health-scan", "session-health-session", "session-health-repair"];
/** 依据开关判定某方法是否启用。 */
declare function methodEnabled(method: string, config: Required<StewardConfig>): boolean;
/**
 * 处理一次 API 调用（导出以便单测直接驱动，不需要起 HTTP）。
 * @param method - 路由方法名。
 * @param payload - 已解析的请求体。
 * @param runtime - 运行时依赖。
 */
declare function handleMethod(method: string, payload: unknown, runtime: StewardRuntime): Promise<unknown>;
/**
 * 插件主体：注册设置命名空间、装配运行时、挂载 fenced 路由。
 * @param ctx - host 插件上下文（webServer / webRuntime / 可选 settings、sessionQuery、sessions、sessionProjections）。
 */
declare function apply(ctx: Context): void;
//#endregion
export { DEFAULT_CONFIG, HEALTH_METHODS, HISTORY_METHODS, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE, type StewardConfig, StewardRuntime, apply, buildProjectionOwnerIndex, buildSessionReport, createAttributor, decodeSessionLogBytes, decodeSessionLogFile, discoverSessions, findSessionLog, firstLosslessViolation, gateColdRead, gateLogIntegrity, gateLosslessJson, gateProjectionCache, handleMethod, inject, isLossless, listHistory, methodEnabled, prescribe, pruneArchiveFile, pruneHistory, quarantineProjectionCache, readArchiveSet, readProjectionCache, readTailFacts, scanSessions, scanZstdFrames };
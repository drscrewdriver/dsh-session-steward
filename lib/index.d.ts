import z from "@deepseek-ai/schemastery";
//#region node_modules/cosmokit/lib/index.d.ts
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
type Promisify<T> = Promise<T extends Promise<infer S> ? S : T>;
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>;
//#endregion
//#region node_modules/@standard-schema/spec/dist/index.d.ts
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
//#region node_modules/cordis/lib/utils.d.ts
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
//#region node_modules/cordis/lib/registry.d.ts
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
//#region node_modules/cordis/lib/reflect.d.ts
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
//#region node_modules/cordis/lib/fiber.d.ts
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
//#region node_modules/cordis/lib/events.d.ts
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
//#region node_modules/cordis/lib/logger.d.ts
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
//#region node_modules/cordis/lib/context.d.ts
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
//#region node_modules/cordis/lib/service.d.ts
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
  /** 会话历史文件（归档浏览与清理）。关闭后不注册 history 路由、不渲染「养老院」页签。 */
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
  /**
   * 宿主内存 registry 里的同一集合（尽力而为，读不到时缺省）。
   *
   * 与 `ids` 的差集 = 「已从存储文件移除、但本进程仍生效」的悬挂项：
   * registry 是宿主启动时载入的快照，prune 写不到它，重启才会重载。
   */
  registryIds?: readonly string[];
}
/** workspaceRegistry 镜像面（只读 getter）。 */
interface StewardRegistryFace {
  readonly archivedSessionIds: readonly string[];
}
/**
 * 解析一次官方归档集合。
 *
 * **存储文件优先**：prune 唯一能改的就是这份文件，列表必须与「能被改的那份」
 * 同源，否则清理成功后面板看起来毫无变化 —— 宿主 registry 是进程启动时的快照，
 * 直接编辑文件不会回写它，于是「文件在瘦身、列表纹丝不动」。
 * registry 退居为文件缺失时的兜底，同时作为诊断面（`registryIds`）返回。
 * @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
 * @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
 * @returns 归档 ids、服务它的来源，以及宿主内存里的同一集合。
 */
declare function readArchiveSet(registry?: StewardRegistryFace, searchPaths?: readonly string[]): StewardArchiveRead;
/** 一次存储文件编辑的结果。 */
type StewardEditOutcome = {
  ok: true;
  changed: boolean;
  file: string;
} | {
  ok: false;
  reason: string;
};
/**
 * **本插件写 workspace.json 的唯一入口。**
 *
 * 任何「改归档集合 / 改工作区成员表」都必须走这里 —— 出现第二个写文件的实现，
 * 就会重现「读的人和写的人不是同一份数据」那类问题。
 *
 * 协议与 storage-json 自身一致：读 → `edit(document)` 就地改 → 备份 → 同目录临时写入
 * → 原子改名。`edit` 返回 `false` 表示无需写入（此时**不产生备份**）。
 * @param path - 规范存储文件路径。
 * @param edit - 就地修改文档；返回是否真的改了。
 * @param log - 可选日志出口。
 * @returns 编辑结果；失败时给出原因而非抛错。
 */
declare function editWorkspaceDocument(path: string, edit: (document: Record<string, unknown>) => boolean, log?: (msg: string) => void): StewardEditOutcome;
/**
 * 从存储中枢的 `global.archivedSessionIds` 中移除会话 id（= 取消归档状态）。
 *
 * 官方后端没有 unarchive 端点，因此直接编辑规范文件；运行中的宿主把集合留在内存里、
 * 只在启动时重载 —— 调用方必须提示需要重启 DSH。
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
  /**
   * 日志首行的 header（`type: 'session'` 记录）。
   *
   * 取它是为了拿到 `version`（格式代次）：文件名代次与 header 代次都由宿主的
   * 代次发布路径写入，二者一致是发布不变量。首行不是 JSON 时为 undefined，
   * 由 `log-integrity` 门按解码问题如实报出，不在这里抛。
   */
  header?: Record<string, unknown>;
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
 * @param file - 当前代日志的绝对路径（由代次解析得出，不假定具体文件名）。
 * @param bytes - 文件内容（调用方读取，便于测试注入）。
 * @param decoders - 可选官方解码器（缺省用本地等价实现）。
 * @returns 事件、统计与问题清单。
 */
declare function decodeSessionLogBytes(file: string, bytes: Buffer, decoders?: OfficialDecoders): SessionLogRead;
/** 从文件读取并解码。 */
declare function decodeSessionLogFile(file: string, decoders?: OfficialDecoders): SessionLogRead;
//#endregion
//#region src/host/health/generation.d.ts
/** 日志的物理编码（对齐宿主的 `JsonlCompression`）。 */
type LogCompression = 'zstd' | 'none';
/** 处置优先级：`high` = 该会话的当前代是从暂存（TMP）发布出来的。 */
type SessionPriority = 'high' | 'normal';
/** 一份日志产物在磁盘上的事实。 */
interface LogArtifact {
  /** 文件名（不含目录）。 */
  name: string;
  /** 绝对路径。 */
  path: string;
  bytes: number;
  /** mtime（epoch ms）。 */
  mtimeMs: number;
}
/** 一份规范代次产物。 */
interface GenerationArtifact extends LogArtifact {
  /** 该文件承载的格式代次；0 为无版本号的历史代。 */
  version: number;
  /** 该文件的物理编码。 */
  compression: LogCompression;
}
/** 一个会话目录的代次事实。 */
interface SessionGenerations {
  /** 目录内全部规范产物，按代次升序（同代次再按 mtime 升序）。 */
  canonical: GenerationArtifact[];
  /** 当前代 = 规范产物中代次最高的一份；目录内没有规范产物时为 undefined。 */
  current?: GenerationArtifact;
  /** 历史代（代次 0）；宿主按契约保留已提交的旧代次，不删不改。 */
  legacy?: GenerationArtifact;
  /** 迁移暂存残留（发布源）。 */
  staging: LogArtifact[];
  /** 只有历史代、尚无更高代次：宿主首次写访问才会发布，冷读要全量内存迁移。 */
  legacyOnly: boolean;
}
/**
 * 某代次的规范日志文件名。
 * @param version - 非负安全整数的格式代次。
 * @param compression - 物理编码（缺省 zstd）。
 * @returns 该代次在会话目录内的文件名。
 */
declare function generationLogFilename(version: number, compression?: LogCompression): string;
/**
 * 把一个规范日志名解析回代次。
 *
 * 与宿主 `parseGenerationLogFilename` 同语义：非规范名（临时、大写、前导零、
 * `.v0`、别的压缩后缀）一律返回 undefined，**不猜**。
 * @param filename - 会话目录里的一个文件名。
 * @param compression - 该目录使用的物理编码（缺省 zstd）。
 * @returns 其格式代次，或名字不构成规范代次时的 undefined。
 */
declare function parseGenerationLogFilename(filename: string, compression?: LogCompression): number | undefined;
/**
 * 两种压缩编码都试一遍，判定该名字是不是某代的规范产物。
 *
 * 发现路径不能假设部署里的 `compression` 配置：配置在 profile 侧，插件读不到，
 * 而日志就在磁盘上。因此按名字本身分类，编码作为结果一并带回。
 * @param filename - 会话目录里的一个文件名。
 * @returns 代次与编码，或该名字不是规范代次时的 undefined。
 */
declare function classifyGenerationFilename(filename: string): {
  version: number;
  compression: LogCompression;
} | undefined;
/**
 * 该文件名是否是迁移暂存（当前代的发布源）。
 * @param filename - 会话目录里的一个文件名。
 * @returns 是否形如 `session.migration.<token>.jsonl[.zstd].tmp`。
 */
declare function isMigrationStagingFilename(filename: string): boolean;
/**
 * 读取一个会话目录的代次事实（只读，不碰任何文件内容）。
 * @param dir - 会话目录的绝对路径。
 * @returns 规范产物（按代次升序）、当前代、历史代与暂存残留。
 */
declare function readSessionGenerations(dir: string): SessionGenerations;
/** 目录内全部已识别产物的最新 mtime。 */
declare function latestArtifactMtime(facts: SessionGenerations): number | undefined;
/**
 * 该会话的处置优先级。
 *
 * `high` 的判据就是「从 TMP 移出来」本身：当前代次非 0（当前代是经
 * `session.migration.*.tmp` 暂存发布出来的），或目录内仍有暂存残留。
 * 代次 0 的历史代是宿主按契约保留的未发布会话，旧发现逻辑读的就是它 —— 这类
 * 会话既没有发布痕迹、也没有被读错，故为 `normal`。
 * @param facts - 会话目录的代次事实。
 * @returns 处置优先级。
 */
declare function sessionPriority(facts: SessionGenerations): SessionPriority;
//#endregion
//#region src/host/health/gates.d.ts
/**
 * gate 严重级。
 *
 * 判定标准（新增 gate 必须遵守）：
 * - `ok`：判定通过；
 * - `warn`：**观测到了**异常现象，但尚不致命（必须有可复现的观测依据）；
 * - `fail`：观测到硬损坏，判定不通过；
 * - `skipped`：**无从观测/无从判定**（冷态会话没有热态投影、缓存记录尚未生成、
 *   日志里没有 turn/end 可判）——中性档，不抬升会话总判。
 *
 * 关键区分：把「无法判定」记成 `warn` 是错的。那会让所有无从观测的会话恒为
 * 「注意」，真信号被淹没（实测事故：30 条会话全标「注意」）。
 * 无从观测 ⇒ `skipped`，有观测依据 ⇒ `warn`。
 */
type GateLevel = 'ok' | 'warn' | 'fail' | 'skipped';
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
  id: 'generation' | 'log-integrity' | 'projection-cache' | 'lossless-json' | 'cold-read';
  level: GateLevel;
  evidence: string;
  attribution?: GateAttribution;
  detail?: Record<string, unknown>;
}
/** 单会话体检报告。 */
interface SessionHealthReport {
  sessionId: string;
  level: GateLevel;
  /**
   * 处置优先级：`high` = 该会话的当前代是从迁移暂存（TMP）发布出来的。
   *
   * 与 `level` 正交：优先级答「先看谁」，档位答「要不要处置」。
   */
  priority: SessionPriority;
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
  /**
   * 会话目录的代次事实（见 `generation.ts`）。
   *
   * 不提供时 `generation` 门记 `skipped`（无从判定），不猜、也不当作正常。
   */
  generations?: SessionGenerations;
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
/**
 * gate 0：代次事实（当前代是历史代还是已发布代、有没有暂存残留）。
 *
 * 存在的理由：一个会话目录里可以有多份日志产物，而**读哪一份**决定了后面所有
 * 门的结论。早期版本固定读 `session.jsonl.zstd`，于是对已发布当前代的会话要么
 * 读错（读历史代那份，12MB 全量回放）、要么完全发现不了。本门把这个前提显式化成
 * 可判定的证据，档位判据只取「有据可依」的三条：
 *   - 没有任何规范产物（只剩暂存）→ `fail`：当前代尚未发布；
 *   - 有暂存残留 → `warn`：发布源仍在原地（发布完成未清，或尚未发布）；
 *   - 文件名代次与 header 代次不一致 → `warn`：发布不变量被破坏。
 * 历史代与当前代并存是宿主**契约要求**（已提交代次不删不改），故记 `ok` 并写进
 * 证据，不抬档 —— 抬档会把 34 个完全正常的会话变成噪声。
 * @param facts - 会话目录的代次事实；缺省表示无从判定。
 * @param log - 已解码的日志（用于取 header.version 交叉核对）。
 */
declare function gateGeneration(facts: SessionGenerations | undefined, log?: SessionLogRead): GateResult;
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
/** 聚合全部 gate 结果为一份报告。 */
declare function buildSessionReport(context: GateContext): SessionHealthReport;
//#endregion
//#region src/host/health/cache.d.ts
/** 一份已成型的缓存。 */
interface HealthCacheEntry {
  /** 非 ok 的会话报告（与 `onlyProblems: true` 的扫描结果同构）。 */
  findings: SessionHealthReport[];
  /** 生成这份缓存时的语料总数（用于「语料已变化」判断）。 */
  total: number;
  /** 生成时刻（epoch ms）。面板据此显示「N 分钟前」。 */
  generatedAt: number;
}
/** 进程内体检缓存：分批扫描过程中累积，走完一遍语料才成型。 */
declare class HealthCache {
  private ready;
  private pending;
  /** 读当前成型的缓存（未成型则 undefined）。 */
  read(): HealthCacheEntry | undefined;
  /** 开始一轮分批扫描（客户端以 `offset: 0` 发起时调用）。 */
  begin(total: number): void;
  /**
   * 追加一批扫描结果。
   *
   * 只有累积的已访问数走满语料总数才成型；语言中途断掉（关面板、报错）不会留下
   * 半份缓存冒充完整结果。
   * @param findings - 本批的非 ok 报告。
   * @param scanned - 本批**已访问**的会话数（不是命中数）。
   * @param now - 时间源（测试可控）。
   * @returns 本批追加后缓存是否刚好成型。
   */
  append(findings: SessionHealthReport[], scanned: number, now?: () => number): boolean;
  /**
   * 单条就地回写（单会话体检 / 可逆处置后调用）。
   *
   * 这是缓存的**关键收益**：处置本就重算了 `after` 报告，把它写回即可，
   * 不必为了刷新一行而重扫整个语料。
   * @param report - 重算出的单会话报告。
   * @returns 是否真的改动了缓存（无缓存时为 false）。
   */
  patch(report: SessionHealthReport): boolean;
  /** 丢弃缓存与未完成的累积。 */
  clear(): void;
}
//#endregion
//#region src/host/history/archive.d.ts
/** 一行历史文件条目（尽力而为的元数据 + 磁盘占用）。 */
interface StewardHistoryRow {
  sessionId: string;
  title: string;
  cwd: string;
  updatedAt: number;
  /** 转录目录占用字节数（未知/未解析时为 0）。 */
  bytes: number;
  /** 投影缓存占用字节数。 */
  cacheBytes: number;
}
/** 列表结果。 */
interface StewardHistoryListResult {
  ok: boolean;
  items?: StewardHistoryRow[];
  /** 归档集合来源；`none` 表示两处都没读到。 */
  source?: 'registry' | 'storage-file' | 'none';
  /** 元数据降级原因（标题/cwd 缺失时给出）。 */
  degraded?: string;
  /**
   * 已从存储文件移除、但宿主内存 registry 里仍生效的 id 数。
   *
   * 大于 0 时列表展示的是**存储文件真值**（已不含这些 id），但它们在本进程内
   * 仍然隐藏着对应会话 —— 面板据此提示「需重启 DSH 才彻底消失」。
   */
  pendingRestart?: number;
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
declare function listHistory(getRegistry: () => StewardRegistryFace | undefined, query?: StewardTitleQueryFace, searchPaths?: readonly string[], dshHome?: string): Promise<StewardHistoryListResult>;
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
//#region src/host/history/purge.d.ts
/** 一个归档会话在磁盘上的实体与占用。 */
interface StewardSessionUsage {
  sessionId: string;
  /** 转录目录绝对路径（不存在时缺省）。 */
  dir?: string;
  /** 转录目录占用字节数。 */
  bytes: number;
  /** 投影缓存文件绝对路径（不存在时缺省）。 */
  cacheFile?: string;
  /** 投影缓存占用字节数。 */
  cacheBytes: number;
}
/** 转录根目录（`<dshHome>/sessions`）。 */
declare function sessionsRootFor(dshHome: string): string;
/**
 * 投影缓存（**逐条布局**）根目录。
 *
 * 注意另有一个 `<dshHome>/storages/session_projcache.json`（整份布局）——
 * 那是布局迁移留下的**化石**，宿主早已不再写它，本插件也不碰它。
 */
declare function projCacheRootFor(dshHome: string): string;
/**
 * 扫一遍转录根，建立「会话 id → 目录」索引。
 *
 * 同一个 id 同时存在带前缀与不带前缀的目录时，**优先带 `session-` 前缀的那个**
 * （归档集合里的 id 本身带前缀）。
 * @param sessionsRoot - `<dshHome>/sessions`。
 * @returns 归一化 id → 目录绝对路径。
 */
declare function indexSessionDirs(sessionsRoot: string): Map<string, string>;
/** 递归求目录占用字节数（读不到的条目跳过，不抛错）。 */
declare function dirSize(dir: string): number;
/**
 * 解析一批会话在磁盘上的实体与占用（**只读，不删任何东西**）。
 *
 * 列表按行显示体积就走这里 —— 体积差异极大（实测单条缓存可达 23 MB、单条转录可达
 * 6 MB，也有 0 字节的），报一个总量对用户没有意义。
 * @param ids - 会话 id（带不带 `session-` 前缀都接受）。
 * @param dshHome - DSH 主目录。
 * @returns 会话 id → 实体位置与占用。
 */
declare function locateSessionUsage(ids: readonly string[], dshHome: string): Map<string, StewardSessionUsage>;
/**
 * 断言目标是 `root` 的**直接子项**（层级也校验）。
 *
 * 破坏性操作不能只靠「路径拼对了」—— 拼错一层就是删掉整个 sessions 根。
 * @param root - 允许的父目录。
 * @param target - 待删目标。
 * @param depth - 相对 root 的期望层数。
 * @returns 是否安全。
 */
declare function isSafeChild(root: string, target: string, depth: number): boolean;
/** 清理结果。 */
interface StewardHistoryPurgeResult {
  ok: boolean;
  /** 成功清理的会话数。 */
  purged?: number;
  /** 释放的字节数（转录 + 投影缓存）。 */
  freedBytes?: number;
  /** 逐条失败原因；不阻断其余条目。 */
  failures?: {
    sessionId: string;
    reason: string;
  }[];
  requiresRestart?: boolean;
  error?: string;
}
/** 清理选项。 */
interface StewardPurgeOptions {
  /** DSH 主目录；**缺失时拒绝执行**（破坏性操作不接受猜测的路径）。 */
  dshHome?: string;
  /** workspace.json 候选路径覆盖（测试注入用）。 */
  searchPaths?: readonly string[];
}
/**
 * `session-history-purge`：**真删除**归档会话的磁盘实体，并连带取消其归档状态。
 * @param payload - `{ sessionIds: string[] }`。
 * @param log - 可选日志出口。
 * @param options - `dshHome` 必填；`searchPaths` 可选覆盖。
 * @returns 清理条数、释放字节数与逐条失败。
 */
declare function purgeHistory(payload: unknown, log?: (msg: string) => void, options?: StewardPurgeOptions): StewardHistoryPurgeResult;
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
/** 处置结果的定性分类。 */
type RepairVerdict =
/** 全部检查通过，没有要做的事。 */
'nothing-to-do' |
/** 处置生效且异常已消除。 */
'repaired' |
/** 处置生效，但仍有与投影缓存无关的异常（如会话日志的 open step）。 */
'repaired-with-residual' |
/** 没有任何可逆处置项能命中当前异常。 */
'not-applicable' |
/** 处置本身执行失败。 */
'failed';
/** 处置结果的判定。 */
interface RepairAssessment {
  verdict: RepairVerdict;
  /** 人读说明：直接展示给用户，解释「为什么处置后还是异常/已恢复」。 */
  explanation: string;
  /** 处置后仍未解决的门（可处置档位）。 */
  residual: {
    id: string;
    level: GateLevel;
  }[];
}
/**
 * 判定一次处置的结果，并给出人读说明。
 *
 * 存在的理由：处置**只**隔离投影缓存记录，而会话的异常可能来自别处
 * （最典型是 `cold-read` 的 open step——插件红线不改会话日志，这类异常
 * 本就不该由处置修复）。旧版 UI 只显示 `处置前/处置后` 两个档位，
 * 两者都是「异常」时用户无法判断是处置失败还是处置与病灶无关。
 *
 * @param input - 处置前后的报告与处置执行结果。
 */
declare function assessRepair(input: {
  before: SessionHealthReport;
  after: SessionHealthReport;
  repair: RepairOutcome;
}): RepairAssessment;
//#endregion
//#region src/host/health/scan.d.ts
/** 一个已发现的会话。 */
interface DiscoveredSession {
  sessionId: string;
  /** 承载日志的代次目录。 */
  dir: string;
  /**
   * 当前代日志路径。
   *
   * 目录内只有迁移暂存（尚未发布当前代）时为 undefined —— 该会话确实存在，
   * 但没有可读的规范产物，由 `generation` / `log-integrity` 两门如实报出，
   * 而不是当作「没有这个会话」。
   */
  logPath?: string;
  /** 代次事实（当前代 / 历史代 / 暂存残留）。 */
  generations: SessionGenerations;
  /** 处置优先级：`high` = 当前代是从暂存（TMP）发布出来的。 */
  priority: SessionPriority;
  updatedAt: number;
  bytes: number;
}
/**
 * 枚举全部会话（按 mtime 倒序），带可选上限。
 *
 * 「是会话目录」的判据是**目录里有规范代次产物或迁移暂存**，不要求任何具体文件名。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 * @param limit - 返回上限（缺省 `DISCOVERY_LIMIT`）。
 */
declare function discoverSessions(dshHome?: string, limit?: number): DiscoveredSession[];
/**
 * 语料总数：只做目录枚举，**不跑体检**。
 *
 * 用于判断缓存是否已过期——枚举很便宜，而重扫要解 zstd、跑门。
 * 正因为两者代价差着量级，「对账」才不构成缓存失效策略本身。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 */
declare function countCorpus(dshHome?: string): number;
/** 按 id 定位一个会话（跨工程目录查找）。 */
declare function findSession(sessionId: string, dshHome?: string): DiscoveredSession | undefined;
/**
 * 定位一个会话的**当前代**日志路径（跨工程目录查找）。
 *
 * 返回 undefined 有两种含义，调用方必须区分：会话不存在，或会话存在但尚未发布
 * 当前代（只有迁移暂存）。需要区分时用 `findSession`。
 * @param sessionId - 会话 id。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 */
declare function findSessionLog(sessionId: string, dshHome?: string): string | undefined;
/** 扫描结果。 */
interface HealthScanResult {
  ok: boolean;
  /** 本批实际体检的会话数（已访问数，不受 onlyProblems 过滤影响）。 */
  scanned: number;
  /**
   * 语料总数（进度分母）。分批调用时每批都拿到同一个值，客户端据此算
   * `已访问 = offset + scanned` / `total`，宿主无需持有跨请求状态。
   */
  total: number;
  /** 本批在语料中的起点（原样回显，便于客户端对账）。 */
  offset: number;
  findings: SessionHealthReport[];
  /** 仅保留非 ok 的报告时使用。 */
  filtered?: boolean;
  error?: string;
}
/**
 * 批量体检（支持分批）。
 *
 * 语料先整体列出（按 mtime 倒序，≤ DISCOVERY_LIMIT），再按 `[offset, offset+limit)`
 * 切片扫描。这样客户端可以用小批次连续调用、自己累计真实进度，而宿主保持无状态
 * ——不必把同步循环改成异步，也不必新增进度轮询端点。
 *
 * 批内**命中顺序**按处置优先级排（`high` 在前，稳定排序）。分批切片仍按 mtime，
 * 所以 offset/total 的算术不受影响：只有同一批里的呈现顺序变了。
 * @param options - dshHome / 批大小 / 批起点 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
 */
declare function scanSessions(options: {
  dshHome?: string;
  limit?: number;
  offset?: number;
  onlyProblems?: boolean;
  attribute?: GateContext['attribute'];
  projectionStateFor?: (sessionId: string) => Record<string, unknown> | undefined;
  now?: () => number;
}): HealthScanResult;
//#endregion
//#region src/index.d.ts
/** 本插件声明的宿主服务（与 toggle 相同的注入面）。 */
declare const inject: string[];
/** 运行时配置 schema（与 src/config.ts 的形状保持一致）。0.1.7：volatile 字段即设置表单。 */
declare const Config: z<Schemastery.ObjectS<NoInfer<{
  enabled: z<boolean, boolean, "volatile-defined">;
  historyFiles: z<boolean, boolean, "volatile-defined">;
  healthCheck: z<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  enabled: z<boolean, boolean, "volatile-defined">;
  historyFiles: z<boolean, boolean, "volatile-defined">;
  healthCheck: z<boolean, boolean, "volatile-defined">;
}>>, "plain">;
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
  /**
   * 体检结果缓存（进程内，随 fiber 存活）。
   *
   * 可选：缺省表示本次装配不启用缓存（只影响「关面板重开」是否零延迟，
   * 不影响任何判定结果）。`apply()` 总是提供实例。
   */
  cache?: HealthCache;
}
/**
 * 支持的路由方法（按子域分组；用于对外声明与测试断言）。
 *
 * `session-history-prune` 与 `session-history-purge` 是**两件事**，不可合并：
 * prune = 取消归档状态（可逆，会话回到侧边栏）；purge = 清理归档文件（不可逆，真删实体）。
 */
declare const HISTORY_METHODS: readonly ["session-history-list", "session-history-prune", "session-history-purge"];
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
 * 插件主体：装配运行时、挂载 fenced 路由。
 * @param ctx - host 插件上下文（webServer / webRuntime / 可选 sessionQuery、sessions、sessionProjections）。
 * @param config - 组合条目（0.1.7：`.volatile()` 字段为 live ref）。
 */
declare function apply(ctx: Context, config?: Partial<StewardConfig>): void;
//#endregion
export { Config, DEFAULT_CONFIG, type DiscoveredSession, type GenerationArtifact, HEALTH_METHODS, HISTORY_METHODS, HealthCache, type HealthCacheEntry, type LogArtifact, type LogCompression, type RepairAssessment, type RepairVerdict, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE, type SessionGenerations, type SessionPriority, type StewardConfig, StewardRuntime, apply, assessRepair, buildProjectionOwnerIndex, buildSessionReport, classifyGenerationFilename, countCorpus, createAttributor, decodeSessionLogBytes, decodeSessionLogFile, dirSize, discoverSessions, editWorkspaceDocument, findSession, findSessionLog, firstLosslessViolation, gateColdRead, gateGeneration, gateLogIntegrity, gateLosslessJson, gateProjectionCache, generationLogFilename, handleMethod, indexSessionDirs, inject, isLossless, isMigrationStagingFilename, isSafeChild, latestArtifactMtime, listHistory, locateSessionUsage, methodEnabled, parseGenerationLogFilename, prescribe, projCacheRootFor, pruneArchiveFile, pruneHistory, purgeHistory, quarantineProjectionCache, readArchiveSet, readProjectionCache, readSessionGenerations, readTailFacts, scanSessions, scanZstdFrames, sessionPriority, sessionsRootFor };
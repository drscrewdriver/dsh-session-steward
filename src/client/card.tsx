/**
 * 设置 scope 面（结构化镜像，与 toggle 的 SwitchCardScope 同形状）。
 *
 * 0.1.7：旧的插件设置卡席位已从宿主删除 —— 配置表单由 host 侧
 * `.volatile()` 字段自动生成，本文件原有的折叠设置卡随之退役。此处的
 * scope 面仍被侧边栏入口消费（页签可见性随配置开关变化）。
 *
 * 旧宿主回退路径按命名空间绑定；0.1.7 走 `configForms.get(entryId)`，
 * 两者成员同名（getSnapshot / subscribe）。
 */
import type { StewardConfig } from '../config.ts'

/** 设置 scope 面（结构化镜像，与 toggle 的 SwitchCardScope 同形状）。 */
export interface StewardCardScope {
  getSnapshot(): {
    status: 'ready' | 'loading' | 'unavailable'
    value: StewardConfig | undefined
    revision?: number
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

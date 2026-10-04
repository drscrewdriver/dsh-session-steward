/**
 * 收藏域（R6）—— 插件自有的 JSON 文件，与索引文件/官方存储彻底分离：
 * 索引会因 schema 重置/影子切换整体更换，收藏不能放里面；官方存储中枢
 * 只读不写（唯一写方纪律不破）。文件形如
 * `<dshHome>/storages/session-steward-favorites.json`：
 * `{ unit: { name, version }, favoriteSessionIds: string[] }`
 * 原子写（tmp+rename），丢失可重建（收藏只是标记，不是数据）。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** 收藏文件候选路径（dshHome 注入；测试可覆盖）。 */
export function favoritesFileCandidates(dshHome: string): string[] {
  return [join(dshHome, 'storages', 'session-steward-favorites.json')]
}

/** 读取收藏集合；文件缺失/畸形一律空数组（收藏只是标记，丢失不致命）。 */
export function listFavorites(searchPaths?: readonly string[]): string[] {
  for (const path of searchPaths ?? []) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { favoriteSessionIds?: unknown }
      if (!Array.isArray(parsed.favoriteSessionIds)) return []
      return parsed.favoriteSessionIds.filter((id): id is string => typeof id === 'string')
    } catch {
      return []
    }
  }
  return []
}

/** 收藏写入结果。 */
export interface FavoritesSetResult {
  ok: boolean
  /** 操作后收藏总数。 */
  total?: number
  error?: string
}

/** 设置单条收藏状态（原子写）。 */
export function setFavoriteState(
  sessionId: string,
  favorite: boolean,
  searchPaths?: readonly string[],
): FavoritesSetResult {
  const path = searchPaths?.[0]
  if (path === undefined || path === '') return { ok: false, error: '缺少收藏文件路径' }
  let ids: string[] = []
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { favoriteSessionIds?: unknown }
      if (Array.isArray(parsed.favoriteSessionIds)) {
        ids = parsed.favoriteSessionIds.filter((id): id is string => typeof id === 'string')
      }
    } catch { /* 畸形文件按空集合重建 */ }
  }
  const without = ids.filter(id => id !== sessionId)
  const next = favorite ? [...without, sessionId] : without
  try {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.fav-tmp`
    writeFileSync(tmp, `${JSON.stringify({
      unit: { name: 'session-steward-favorites', version: 1 },
      favoriteSessionIds: next,
    }, null, 2)}\n`, 'utf8')
    renameSync(tmp, path)
    return { ok: true, total: next.length }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

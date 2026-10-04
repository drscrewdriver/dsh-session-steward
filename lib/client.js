window.__ModuleLoader__.load({
	id: "dsh-session-steward",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/config.ts
		/** 缺省值。 */
		const DEFAULT_CONFIG = {
			enabled: true,
			historyFiles: true,
			healthCheck: true,
			search: true
		};
		/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
		const STEWARD_SETTINGS_NAMESPACE = "session-steward";
		/** 侧边栏入口 id（客户端注册 id）。 */
		const STEWARD_ENTRY_ID = "dsh-session-steward";
		//#endregion
		//#region src/client/locales.ts
		/** 简体中文（内置回退字典）。 */
		const zh$1 = {
			"card.title": "会话管家",
			"card.desc": "历史文件 · 健康检查",
			"card.enabled": "启用会话管家",
			"card.enabled.desc": "关闭后不注册任何接口，侧边栏入口整体消失。",
			"card.history": "会话历史文件",
			"card.history.desc": "归档浏览与清理（养老院）。关闭后不注册历史接口、不渲染该页签。",
			"card.health": "健康检查",
			"card.health.desc": "体检 → 处方 → 出院。关闭后不注册体检接口、不渲染该页签。",
			"card.readonly": "当前会话无法修改设置（只读挂载）。",
			"card.unavailable": "设置服务不可用，无法读取配置。",
			"family.title": "起子插件设置",
			"panel.title": "会话管家",
			"panel.tab.history": "养老院",
			"panel.tab.health": "体检",
			"panel.tab.manage": "管理",
			"panel.close": "关闭",
			"panel.untitled": "（无标题）",
			"history.loading": "正在读取归档列表…",
			"history.empty": "归档集合为空。",
			"history.edit": "编辑",
			"history.done": "完成",
			"history.selectAll": "全选",
			"history.unselectAll": "取消全选",
			"history.unarchive": "取消归档状态 ({n})",
			"history.unarchiving": "取消归档中…",
			"history.purge": "清理归档文件 ({n}) · 释放 {size}",
			"history.purging": "清理中…",
			"history.editingHint": "编辑模式：勾选会话后二选一 ——「取消归档状态」只把它从官方归档数组移除（可逆，重启后回到侧边栏）；「清理归档文件」真删磁盘上的转录与投影缓存（不可逆）。",
			"history.restartHint": "已从归档数组移除 {removed} 个 id（剩余 {remaining}）。请**立刻重启 DSH**：宿主退出前任何归档或工作区改动都会把整份内存快照写回文件，这次操作会被还原。",
			"history.pendingRestart": "宿主内存里仍有 {n} 个归档未失效：列表已按存储文件显示（这些已不在），但它们对应的会话在重启 DSH 前仍被侧边栏隐藏。",
			"history.count": "共 {n} 条 · 占 {size}",
			"history.size": "转录 {t} · 缓存 {c}",
			"history.sizeUnknown": "磁盘上无实体",
			"history.source.registry": "来源：宿主归档注册表",
			"history.source.storage-file": "来源：存储文件",
			"history.source.none": "两处都读不到归档集合",
			"history.confirmUnarchive": "确认取消这 {n} 个会话的归档状态？\n\n{summary}\n\n只改归档数组（自动备份），磁盘文件不动。重启 DSH 后这些会话回到原工作区。",
			"history.confirmPurge": "确认清理这 {n} 个归档会话的磁盘文件？\n\n{summary}\n\n合计释放约 {size}。\n将删除：转录目录（含旧格式副本）、逐条投影缓存，并从归档数组与工作区成员表中移除。\n\n**此操作不可逆，会话将无法恢复。**",
			"history.purgeResult": "已清理 {purged} 个归档会话，释放 {size}。请重启 DSH 使其彻底消失。",
			"history.purgePartial": "已清理 {purged} 个，释放 {size}；{failed} 个失败（见下方明细）。",
			"history.purgeFailures": "失败明细",
			"health.scan": "开始体检",
			"health.scanning": "体检中…",
			"health.progress": "{done}/{total} · 已用 {sec}s",
			"health.empty": "未发现异常会话。",
			"health.clean": "全部检查通过。",
			"health.level.ok": "正常",
			"health.level.warn": "注意",
			"health.level.skipped": "未检查",
			"health.level.fail": "异常",
			"health.priority.high": "优先",
			"health.gate.generation": "代次产物",
			"health.gate.log-integrity": "日志完整性",
			"health.gate.projection-cache": "投影缓存",
			"health.gate.lossless-json": "无损 JSON",
			"health.gate.cold-read": "可接续性",
			"health.gate.source-kind": "插件署名",
			"health.attribution": "归属",
			"health.field": "字段",
			"health.unknownOwner": "归属未知",
			"health.phase.checkup": "① 体检",
			"health.phase.prescribe": "② 处方",
			"health.phase.discharge": "③ 出院",
			"health.repair": "执行可逆处置",
			"health.repairing": "处置中…",
			"health.sourceMigrate": "转换旧署名",
			"health.sourceMigrating": "转换中…",
			"health.sourceMigrated": "已转换 {n} 行旧署名（备份：{backup}）",
			"health.sourceMigrateNone": "没有需要转换的旧署名行",
			"health.sourceMigrateFail": "转换失败：{error}",
			"health.before": "处置前",
			"health.after": "处置后",
			"health.quarantined": "已隔离投影缓存记录（重启 DSH 后重折叠）",
			"health.commands": "可执行命令",
			"health.copy": "复制",
			"health.copied": "已复制",
			"health.detail": "查看详情",
			"health.back": "返回列表",
			"health.cache.hint": "结果来自缓存 · {ago}",
			"health.cache.refresh": "刷新",
			"health.cache.corpusChanged": "语料已变化（{was} → {now}），建议刷新",
			"health.ago.justNow": "刚刚",
			"health.ago.minutes": "{n} 分钟前",
			"health.ago.hours": "{n} 小时前",
			"health.ago.days": "{n} 天前"
		};
		/**
		* Todas las locales / 全部语言，按 locale 服务消费的形态组合。
		* 单次注册即可激活全部 9 种语言（zh/en 为宿主内置，其余走同一 map 重载）。
		*/
		const dictionaries$1 = {
			zh: zh$1,
			en: {
				"card.title": "Session Steward",
				"card.desc": "History files · Health check",
				"card.enabled": "Enable Session Steward",
				"card.enabled.desc": "When off, no API is registered and the sidebar entry disappears.",
				"card.history": "Session history files",
				"card.history.desc": "Archive browsing and cleanup (Retirement Home). When off, history routes and the tab are gone.",
				"card.health": "Health check",
				"card.health.desc": "Checkup → Prescription → Discharge. When off, health routes and the tab are gone.",
				"card.readonly": "This session cannot edit settings (read-only mount).",
				"card.unavailable": "Settings service unavailable; configuration cannot be read.",
				"family.title": "Screwdriver plugin settings",
				"panel.title": "Session Steward",
				"panel.tab.history": "Retirement Home",
				"panel.tab.health": "Checkup",
				"panel.tab.manage": "Manage",
				"panel.close": "Close",
				"panel.untitled": "(untitled)",
				"history.loading": "Loading archived sessions…",
				"history.empty": "The archive set is empty.",
				"history.edit": "Edit",
				"history.done": "Done",
				"history.selectAll": "Select all",
				"history.unselectAll": "Clear selection",
				"history.unarchive": "Unarchive state ({n})",
				"history.unarchiving": "Unarchiving…",
				"history.purge": "Purge archive files ({n}) · free {size}",
				"history.purging": "Purging…",
				"history.editingHint": "Edit mode: tick sessions, then pick one — \"Unarchive state\" only removes them from the official archive array (reversible; they return to the sidebar after a restart); \"Purge archive files\" really deletes the transcript and projection cache from disk (irreversible).",
				"history.restartHint": "Removed {removed} id(s) from the archive array ({remaining} left). **Restart DSH now**: until the host exits, any archive or workspace change rewrites the whole in-memory snapshot back to the file and undoes this.",
				"history.pendingRestart": "{n} archived id(s) are still live in host memory: the list follows the storage file (they are already gone), but their sessions stay hidden from the sidebar until DSH restarts.",
				"history.count": "{n} total · {size} on disk",
				"history.size": "transcript {t} · cache {c}",
				"history.sizeUnknown": "no on-disk entity",
				"history.source.registry": "Source: host archive registry",
				"history.source.storage-file": "Source: storage file",
				"history.source.none": "The archive set is unreadable from both sources",
				"history.confirmUnarchive": "Unarchive these {n} session(s)?\n\n{summary}\n\nOnly the archive array is edited (auto backup); nothing on disk is touched. After a DSH restart these sessions return to their workspaces.",
				"history.confirmPurge": "Purge the on-disk files of these {n} archived session(s)?\n\n{summary}\n\nAbout {size} will be freed.\nThis deletes: the transcript directory (including older-format copies) and the per-session projection cache, and removes them from the archive array and the workspace membership tables.\n\n**This cannot be undone — the sessions will be unrecoverable.**",
				"history.purgeResult": "Purged {purged} archived session(s), freed {size}. Restart DSH to make them disappear completely.",
				"history.purgePartial": "Purged {purged}, freed {size}; {failed} failed (see details below).",
				"history.purgeFailures": "Failure details",
				"health.scan": "Run checkup",
				"health.scanning": "Running…",
				"health.progress": "{done}/{total} · {sec}s elapsed",
				"health.empty": "No problem session found.",
				"health.clean": "All checks passed.",
				"health.level.ok": "ok",
				"health.level.warn": "warn",
				"health.level.skipped": "Not checked",
				"health.level.fail": "fail",
				"health.priority.high": "Priority",
				"health.gate.generation": "Generation artifact",
				"health.gate.log-integrity": "Log integrity",
				"health.gate.projection-cache": "Projection cache",
				"health.gate.lossless-json": "Lossless JSON",
				"health.gate.cold-read": "Continuability",
				"health.gate.source-kind": "Plugin signature",
				"health.attribution": "Owner",
				"health.field": "Field",
				"health.unknownOwner": "owner unknown",
				"health.phase.checkup": "1) Checkup",
				"health.phase.prescribe": "2) Prescription",
				"health.phase.discharge": "3) Discharge",
				"health.repair": "Apply reversible repair",
				"health.repairing": "Repairing…",
				"health.sourceMigrate": "Migrate legacy signatures",
				"health.sourceMigrating": "Migrating…",
				"health.sourceMigrated": "Migrated {n} legacy signature rows (backup: {backup})",
				"health.sourceMigrateNone": "No legacy signature rows to migrate",
				"health.sourceMigrateFail": "Migration failed: {error}",
				"health.before": "Before",
				"health.after": "After",
				"health.quarantined": "Projection cache quarantined (refolds after a DSH restart)",
				"health.commands": "Commands",
				"health.copy": "Copy",
				"health.copied": "Copied",
				"health.detail": "Details",
				"health.back": "Back",
				"health.cache.hint": "Cached result · {ago}",
				"health.cache.refresh": "Refresh",
				"health.cache.corpusChanged": "Corpus changed ({was} → {now}); refresh recommended",
				"health.ago.justNow": "just now",
				"health.ago.minutes": "{n} min ago",
				"health.ago.hours": "{n} h ago",
				"health.ago.days": "{n} d ago"
			},
			ja: {
				"card.title": "セッションスチュワード",
				"card.desc": "履歴ファイル · ヘルスチェック",
				"card.enabled": "セッションスチュワードを有効化",
				"card.enabled.desc": "オフにすると API を一切登録せず、サイドバーの入口も消えます。",
				"card.history": "セッション履歴ファイル",
				"card.history.desc": "アーカイブの閲覧とクリーンアップ（老人ホーム）。オフにすると履歴 API を登録せず、このタブも描画しません。",
				"card.health": "ヘルスチェック",
				"card.health.desc": "健診 → 処方 → 退院。オフにすると健診 API を登録せず、このタブも描画しません。",
				"card.readonly": "このセッションでは設定を変更できません（読み取り専用マウント）。",
				"card.unavailable": "設定サービスが利用できず、構成を読み取れません。",
				"family.title": "スクリュードライバー プラグイン設定",
				"panel.title": "セッションスチュワード",
				"panel.tab.history": "老人ホーム",
				"panel.tab.health": "健診",
				"panel.close": "閉じる",
				"panel.untitled": "（無題）",
				"history.loading": "アーカイブ一覧を読み込んでいます…",
				"history.empty": "アーカイブ集合は空です。",
				"history.edit": "編集",
				"history.done": "完了",
				"history.selectAll": "すべて選択",
				"history.unselectAll": "全選択を解除",
				"history.unarchive": "アーカイブ状態を解除 ({n})",
				"history.unarchiving": "アーカイブ解除中…",
				"history.purge": "アーカイブファイルを消去 ({n}) · {size} 解放",
				"history.purging": "消去中…",
				"history.editingHint": "編集モード：セッションにチェックを入れ、二者択一 ——「アーカイブ状態を解除」は公式アーカイブ配列から除去するだけ（可逆、再起動後サイドバーに戻る）；「アーカイブファイルを消去」はディスク上のトランスクリプトと投影キャッシュを実削除します（不可逆）。",
				"history.restartHint": "アーカイブ配列から {removed} 件の id を除去しました（残り {remaining}）。**今すぐ DSH を再起動**：ホスト終了前にアーカイブやワークスペースへの変更があると、メモリ全体のスナップショットがファイルへ書き戻され、この操作が巻き戻ります。",
				"history.pendingRestart": "ホストのメモリ内にはまだ {n} 件のアーカイブが無効化されていません：一覧はストレージファイルに従って表示されます（これらは既に存在しない）が、対応するセッションは DSH を再起動するまでサイドバーに隠れたままです。",
				"history.count": "全 {n} 件 · 占有 {size}",
				"history.size": "トランスクリプト {t} · キャッシュ {c}",
				"history.sizeUnknown": "ディスク上に実体なし",
				"history.source.registry": "取得元：ホストのアーカイブレジストリ",
				"history.source.storage-file": "取得元：ストレージファイル",
				"history.source.none": "どちらのソースからもアーカイブ集合を読めません",
				"history.confirmUnarchive": "これら {n} 件のセッションのアーカイブ状態を解除しますか？\n\n{summary}\n\nアーカイブ配列のみを編集します（自動バックアップ）、ディスク上のファイルは動きません。DSH 再起動後、これらのセッションは元のワークスペースに戻ります。",
				"history.confirmPurge": "これら {n} 件のアーカイブ済みセッションのディスク上のファイルを消去しますか？\n\n{summary}\n\n合計約 {size} を解放します。\n削除対象：トランスクリプトディレクトリ（旧形式のコピーを含む）、個別の投影キャッシュ、およびアーカイブ配列とワークスペースメンバーテーブルからの除去。\n\n**この操作は不可逆で、セッションは復元できません。**",
				"history.purgeResult": "{purged} 件のアーカイブ済みセッションを消去し、{size} を解放しました。完全に消失させるには DSH を再起動してください。",
				"history.purgePartial": "{purged} 件を消去し、{size} を解放；{failed} 件が失敗（以下の明細参照）。",
				"history.purgeFailures": "失敗の明細",
				"health.scan": "健診を開始",
				"health.scanning": "健診中…",
				"health.progress": "{done}/{total} · 経過 {sec}s",
				"health.empty": "異常なセッションは見つかりませんでした。",
				"health.clean": "すべてのチェックに合格しました。",
				"health.level.ok": "正常",
				"health.level.warn": "注意",
				"health.level.skipped": "未チェック",
				"health.level.fail": "異常",
				"health.priority.high": "優先",
				"health.gate.generation": "世代アーティファクト",
				"health.gate.log-integrity": "ログ完全性",
				"health.gate.projection-cache": "投影キャッシュ",
				"health.gate.lossless-json": "可逆 JSON",
				"health.gate.cold-read": "継続可能性",
				"health.gate.source-kind": "プラグイン署名",
				"health.attribution": "帰属",
				"health.field": "フィールド",
				"health.unknownOwner": "帰属不明",
				"health.phase.checkup": "① 健診",
				"health.phase.prescribe": "② 処方",
				"health.phase.discharge": "③ 退院",
				"health.repair": "可逆的な処置を実行",
				"health.repairing": "処置中…",
				"health.sourceMigrate": "旧署名を変換",
				"health.sourceMigrating": "変換中…",
				"health.sourceMigrated": "{n} 行の旧署名を変換しました（バックアップ：{backup}）",
				"health.sourceMigrateNone": "変換すべき旧署名行はありません",
				"health.sourceMigrateFail": "変換に失敗：{error}",
				"health.before": "処置前",
				"health.after": "処置後",
				"health.quarantined": "投影キャッシュのレコードを隔離しました（DSH 再起動後に再折り畳み）",
				"health.commands": "実行可能なコマンド",
				"health.copy": "コピー",
				"health.copied": "コピーしました",
				"health.detail": "詳細を見る",
				"health.back": "一覧に戻る",
				"health.cache.hint": "結果はキャッシュ由来 · {ago}",
				"health.cache.refresh": "更新",
				"health.cache.corpusChanged": "コーパスが変化（{was} → {now}）、更新を推奨",
				"health.ago.justNow": "たった今",
				"health.ago.minutes": "{n} 分前",
				"health.ago.hours": "{n} 時間前",
				"health.ago.days": "{n} 日前"
			},
			ko: {
				"card.title": "세션 스튜어드",
				"card.desc": "기록 파일 · 건강 점검",
				"card.enabled": "세션 스튜어드 활성화",
				"card.enabled.desc": "끄면 어떤 API도 등록하지 않고 사이드바 항목이 통째로 사라집니다.",
				"card.history": "세션 기록 파일",
				"card.history.desc": "아카이브 탐색 및 정리(요양소). 끄면 기록 API를 등록하지 않고 이 탭을 렌더링하지 않습니다.",
				"card.health": "건강 점검",
				"card.health.desc": "진료 → 처방 → 퇴원. 끄면 진료 API를 등록하지 않고 이 탭을 렌더링하지 않습니다.",
				"card.readonly": "이 세션에서는 설정을 수정할 수 없습니다(읽기 전용 마운트).",
				"card.unavailable": "설정 서비스를 사용할 수 없어 구성을 읽을 수 없습니다.",
				"family.title": "스크루드라이버 플러그인 설정",
				"panel.title": "세션 스튜어드",
				"panel.tab.history": "요양소",
				"panel.tab.health": "진료",
				"panel.close": "닫기",
				"panel.untitled": "(제목 없음)",
				"history.loading": "아카이브 목록을 읽는 중…",
				"history.empty": "아카이브 집합이 비어 있습니다.",
				"history.edit": "편집",
				"history.done": "완료",
				"history.selectAll": "전체 선택",
				"history.unselectAll": "전체 선택 해제",
				"history.unarchive": "아카이브 상태 해제 ({n})",
				"history.unarchiving": "아카이브 해제 중…",
				"history.purge": "아카이브 파일 정리 ({n}) · {size} 확보",
				"history.purging": "정리 중…",
				"history.editingHint": "편집 모드: 세션을 체크한 뒤 둘 중 하나 —— 「아카이브 상태 해제」는 공식 아카이브 배열에서만 제거(되돌릴 수 있음, 재시작 후 사이드바로 복귀); 「아카이브 파일 정리」는 디스크의 전사본과 투영 캐시를 실제 삭제(되돌릴 수 없음).",
				"history.restartHint": "아카이브 배열에서 id {removed}개를 제거했습니다(남은 {remaining}). **지금 즉시 DSH를 재시작**: 호스트 종료 전 아카이브나 워크스페이스 변경이 있으면 메모리 전체 스냅샷이 파일로 다시 쓰여 이 작업이 되돌려집니다.",
				"history.pendingRestart": "호스트 메모리에 아직 {n}개 아카이브가 유효합니다: 목록은 저장 파일을 따라 표시(이제 없음)하지만, 해당 세션은 DSH 재시작 전까지 사이드바에 숨겨진 채로 남아 있습니다.",
				"history.count": "총 {n}건 · {size} 점유",
				"history.size": "전사본 {t} · 캐시 {c}",
				"history.sizeUnknown": "디스크에 실체 없음",
				"history.source.registry": "출처: 호스트 아카이브 등록부",
				"history.source.storage-file": "출처: 저장 파일",
				"history.source.none": "두 소스 모두에서 아카이브 집합을 읽을 수 없음",
				"history.confirmUnarchive": "이 {n}개 세션의 아카이브 상태를 해제하시겠습니까?\n\n{summary}\n\n아카이브 배열만 편집(자동 백업)하고 디스크 파일은 건드리지 않습니다. DSH 재시작 후 이 세션들은 원래 워크스페이스로 돌아갑니다.",
				"history.confirmPurge": "이 {n}개 아카이브된 세션의 디스크 파일을 정리하시겠습니까?\n\n{summary}\n\n총 약 {size}를 확보합니다.\n삭제 대상: 전사본 디렉터리(구형식 사본 포함)와 건별 투영 캐시, 그리고 아카이브 배열 및 워크스페이스 구성원 표에서 제거.\n\n**이 작업은 되돌릴 수 없으며 세션은 복원되지 않습니다.**",
				"history.purgeResult": "아카이브된 세션 {purged}개를 정리하고 {size}를 확보했습니다. 완전히 사라지게 하려면 DSH를 재시작하세요.",
				"history.purgePartial": "{purged}개 정리, {size} 확보; {failed}개 실패(아래 명세 참조).",
				"history.purgeFailures": "실패 명세",
				"health.scan": "진료 시작",
				"health.scanning": "진료 중…",
				"health.progress": "{done}/{total} · {sec}s 경과",
				"health.empty": "이상 세션을 찾지 못했습니다.",
				"health.clean": "모든 점검을 통과했습니다.",
				"health.level.ok": "정상",
				"health.level.warn": "주의",
				"health.level.skipped": "미점검",
				"health.level.fail": "이상",
				"health.priority.high": "우선",
				"health.gate.generation": "세대 산출물",
				"health.gate.log-integrity": "로그 무결성",
				"health.gate.projection-cache": "투영 캐시",
				"health.gate.lossless-json": "무손실 JSON",
				"health.gate.cold-read": "연속 가능",
				"health.gate.source-kind": "플러그인 서명",
				"health.attribution": "귀속",
				"health.field": "필드",
				"health.unknownOwner": "귀속 불명",
				"health.phase.checkup": "① 진료",
				"health.phase.prescribe": "② 처방",
				"health.phase.discharge": "③ 퇴원",
				"health.repair": "가역적 처치 실행",
				"health.repairing": "처치 중…",
				"health.sourceMigrate": "구 서명 변환",
				"health.sourceMigrating": "변환 중…",
				"health.sourceMigrated": "구 서명 {n}행을 변환했습니다(백업: {backup})",
				"health.sourceMigrateNone": "변환할 구 서명 행이 없습니다",
				"health.sourceMigrateFail": "변환 실패: {error}",
				"health.before": "처치 전",
				"health.after": "처치 후",
				"health.quarantined": "투영 캐시 기록을 격리했습니다(DSH 재시작 후 재접힘)",
				"health.commands": "실행 가능 명령",
				"health.copy": "복사",
				"health.copied": "복사됨",
				"health.detail": "상세 보기",
				"health.back": "목록으로",
				"health.cache.hint": "결과를 캐시에서 · {ago}",
				"health.cache.refresh": "새로고침",
				"health.cache.corpusChanged": "코퍼스 변경({was} → {now}), 새로고침 권장",
				"health.ago.justNow": "방금",
				"health.ago.minutes": "{n}분 전",
				"health.ago.hours": "{n}시간 전",
				"health.ago.days": "{n}일 전"
			},
			fr: {
				"card.title": "Intendant de session",
				"card.desc": "Fichiers d’historique · Contrôle de santé",
				"card.enabled": "Activer l’intendant de session",
				"card.enabled.desc": "Désactivé, aucune API n’est enregistrée et l’entrée de la barre latérale disparaît.",
				"card.history": "Fichiers d’historique de session",
				"card.history.desc": "Consultation et nettoyage des archives (Maison de retraite). Désactivé, aucune API d’historique n’est enregistrée et cet onglet n’est pas rendu.",
				"card.health": "Contrôle de santé",
				"card.health.desc": "Examen → Ordonnance → Sortie. Désactivé, aucune API de contrôle n’est enregistrée et cet onglet n’est pas rendu.",
				"card.readonly": "Cette session ne peut pas modifier les réglages (montage en lecture seule).",
				"card.unavailable": "Service de réglages indisponible ; configuration illisible.",
				"family.title": "Réglages du plugin Screwdriver",
				"panel.title": "Intendant de session",
				"panel.tab.history": "Maison de retraite",
				"panel.tab.health": "Examen",
				"panel.close": "Fermer",
				"panel.untitled": "(sans titre)",
				"history.loading": "Lecture de la liste des archives…",
				"history.empty": "L’ensemble des archives est vide.",
				"history.edit": "Modifier",
				"history.done": "Terminé",
				"history.selectAll": "Tout sélectionner",
				"history.unselectAll": "Tout désélectionner",
				"history.unarchive": "Retirer l’état archivé ({n})",
				"history.unarchiving": "Désarchivage…",
				"history.purge": "Purger les fichiers archivés ({n}) · libérer {size}",
				"history.purging": "Purge…",
				"history.editingHint": "Mode modification : cochez des sessions puis choisissez — « Retirer l’état archivé » ne fait que les retirer du tableau officiel des archives (réversible ; elles reviennent dans la barre latérale après un redémarrage) ; « Purger les fichiers archivés » supprime réellement le transcript et le cache de projection du disque (irréversible).",
				"history.restartHint": "{removed} id retirés du tableau des archives ({remaining} restants). **Redémarrez DSH maintenant** : tant que l’hôte n’est pas fermé, toute modification des archives ou de l’espace de travail réécrit l’intégralité de l’instantané en mémoire vers le fichier et annule cette opération.",
				"history.pendingRestart": "{n} archives sont encore vivantes en mémoire de l’hôte : la liste suit le fichier de stockage (elles n’y sont plus), mais leurs sessions restent masquées de la barre latérale tant que DSH n’a pas redémarré.",
				"history.count": "{n} entrées · {size} occupés",
				"history.size": "transcript {t} · cache {c}",
				"history.sizeUnknown": "aucune entité sur le disque",
				"history.source.registry": "Source : registre d’archives de l’hôte",
				"history.source.storage-file": "Source : fichier de stockage",
				"history.source.none": "L’ensemble des archives est illisible des deux sources",
				"history.confirmUnarchive": "Retirer l’état archivé de ces {n} session(s) ?\n\n{summary}\n\nSeul le tableau des archives est modifié (sauvegarde automatique) ; rien sur le disque n’est touché. Après un redémarrage de DSH, ces sessions reviennent dans leurs espaces de travail.",
				"history.confirmPurge": "Purger les fichiers sur disque de ces {n} session(s) archivée(s) ?\n\n{summary}\n\nEnviron {size} seront libérés.\nSeront supprimés : le répertoire des transcripts (y compris les copies de format antérieur) et le cache de projection par session, puis retrait du tableau des archives et des tables de membres de l’espace de travail.\n\n**Cette opération est irréversible — les sessions seront irrécupérables.**",
				"history.purgeResult": "{purged} session(s) archivée(s) purgée(s), {size} libérés. Redémarrez DSH pour qu’elles disparaissent complètement.",
				"history.purgePartial": "{purged} purgée(s), {size} libérés ; {failed} en échec (voir le détail ci-dessous).",
				"history.purgeFailures": "Détail des échecs",
				"health.scan": "Lancer le contrôle",
				"health.scanning": "Contrôle en cours…",
				"health.progress": "{done}/{total} · {sec}s écoulés",
				"health.empty": "Aucune session problématique trouvée.",
				"health.clean": "Tous les contrôles sont passés.",
				"health.level.ok": "ok",
				"health.level.warn": "attention",
				"health.level.skipped": "Non contrôlé",
				"health.level.fail": "anomalie",
				"health.priority.high": "Priorité",
				"health.gate.generation": "Artefact de génération",
				"health.gate.log-integrity": "Intégrité des journaux",
				"health.gate.projection-cache": "Cache de projection",
				"health.gate.lossless-json": "JSON sans perte",
				"health.gate.cold-read": "Continuité",
				"health.gate.source-kind": "Signature du plugin",
				"health.attribution": "Propriétaire",
				"health.field": "Champ",
				"health.unknownOwner": "propriétaire inconnu",
				"health.phase.checkup": "1) Examen",
				"health.phase.prescribe": "2) Ordonnance",
				"health.phase.discharge": "3) Sortie",
				"health.repair": "Appliquer une réparation réversible",
				"health.repairing": "Réparation…",
				"health.sourceMigrate": "Convertir les signatures héritées",
				"health.sourceMigrating": "Conversion…",
				"health.sourceMigrated": "{n} lignes de signature héritée converties (sauvegarde : {backup})",
				"health.sourceMigrateNone": "Aucune ligne de signature héritée à convertir",
				"health.sourceMigrateFail": "Échec de la conversion : {error}",
				"health.before": "Avant",
				"health.after": "Après",
				"health.quarantined": "Enregistrement du cache de projection mis en quarantaine (replié après un redémarrage de DSH)",
				"health.commands": "Commandes exécutables",
				"health.copy": "Copier",
				"health.copied": "Copié",
				"health.detail": "Voir le détail",
				"health.back": "Retour à la liste",
				"health.cache.hint": "Résultat issu du cache · {ago}",
				"health.cache.refresh": "Rafraîchir",
				"health.cache.corpusChanged": "Corpus modifié ({was} → {now}) ; rafraîchissement conseillé",
				"health.ago.justNow": "à l’instant",
				"health.ago.minutes": "il y a {n} min",
				"health.ago.hours": "il y a {n} h",
				"health.ago.days": "il y a {n} j"
			},
			de: {
				"card.title": "Sitzungs-Verwalter",
				"card.desc": "Verlaufsdateien · Health-Check",
				"card.enabled": "Sitzungs-Verwalter aktivieren",
				"card.enabled.desc": "Wenn aus, wird keine API registriert und der Seitenleisten-Eintrag verschwindet komplett.",
				"card.history": "Sitzungsverlaufsdateien",
				"card.history.desc": "Archivansicht und Bereinigung (Altersheim). Wenn aus, werden keine Verlaufs-Routen registriert und dieser Tab nicht gerendert.",
				"card.health": "Health-Check",
				"card.health.desc": "Untersuchung → Rezept → Entlassung. Wenn aus, werden keine Check-Routen registriert und dieser Tab nicht gerendert.",
				"card.readonly": "Diese Sitzung kann Einstellungen nicht ändern (schreibgeschützter Mount).",
				"card.unavailable": "Einstellungsdienst nicht verfügbar; Konfiguration kann nicht gelesen werden.",
				"family.title": "Screwdriver-Plugin-Einstellungen",
				"panel.title": "Sitzungs-Verwalter",
				"panel.tab.history": "Altersheim",
				"panel.tab.health": "Untersuchung",
				"panel.close": "Schließen",
				"panel.untitled": "(ohne Titel)",
				"history.loading": "Archivliste wird gelesen…",
				"history.empty": "Die Archivmenge ist leer.",
				"history.edit": "Bearbeiten",
				"history.done": "Fertig",
				"history.selectAll": "Alle auswählen",
				"history.unselectAll": "Auswahl aufheben",
				"history.unarchive": "Archivstatus aufheben ({n})",
				"history.unarchiving": "Aufheben des Archivstatus…",
				"history.purge": "Archivdateien löschen ({n}) · {size} freigeben",
				"history.purging": "Löschen…",
				"history.editingHint": "Bearbeitungsmodus: Sitzungen anhaken, dann eine von beiden — „Archivstatus aufheben“ entfernt sie nur aus dem offiziellen Archiv-Feld (umkehrbar; nach einem Neustart zurück in der Seitenleiste); „Archivdateien löschen“ löscht Transkript und Projektions-Cache wirklich von der Disk (unumkehrbar).",
				"history.restartHint": "{removed} id(s) aus dem Archiv-Feld entfernt ({remaining} verbleiben). **DSH jetzt neu starten**: Bevor der Host beendet wird, schreibt jede Archiv- oder Workspace-Änderung den kompletten Speicher-Snapshot zurück in die Datei und macht diese Operation zunichte.",
				"history.pendingRestart": "Im Host-Speicher sind noch {n} Archive aktiv: Die Liste folgt der Speicherdatei (sie sind dort nicht mehr), aber ihre Sitzungen bleiben bis zu einem DSH-Neustart in der Seitenleiste verborgen.",
				"history.count": "{n} Einträge · {size} belegt",
				"history.size": "Transkript {t} · Cache {c}",
				"history.sizeUnknown": "kein Objekt auf der Disk",
				"history.source.registry": "Quelle: Host-Archivregister",
				"history.source.storage-file": "Quelle: Speicherdatei",
				"history.source.none": "Die Archivmenge ist aus beiden Quellen nicht lesbar",
				"history.confirmUnarchive": "Den Archivstatus dieser {n} Sitzung(en) aufheben?\n\n{summary}\n\nNur das Archiv-Feld wird bearbeitet (automatische Sicherung); nichts auf der Disk wird angetastet. Nach einem DSH-Neustart kehren diese Sitzungen in ihre Workspaces zurück.",
				"history.confirmPurge": "Die Dateien auf der Disk dieser {n} archivierten Sitzung(en) löschen?\n\n{summary}\n\nInsgesamt werden etwa {size} freigegeben.\nGelöscht werden: das Transkript-Verzeichnis (inkl. Kopien im Altformat) und der sitzungsweite Projektions-Cache, zudem Entfernung aus dem Archiv-Feld und den Workspace-Mitgliedstabellen.\n\n**Dieser Vorgang ist unumkehrbar — die Sitzungen sind nicht wiederherstellbar.**",
				"history.purgeResult": "{purged} archivierte Sitzung(en) gelöscht, {size} freigegeben. DSH neu starten, damit sie endgültig verschwinden.",
				"history.purgePartial": "{purged} gelöscht, {size} freigegeben; {failed} fehlgeschlagen (Details unten).",
				"history.purgeFailures": "Fehlerdetails",
				"health.scan": "Untersuchung starten",
				"health.scanning": "Untersuchung läuft…",
				"health.progress": "{done}/{total} · {sec}s vergangen",
				"health.empty": "Keine Problem-Sitzung gefunden.",
				"health.clean": "Alle Prüfungen bestanden.",
				"health.level.ok": "ok",
				"health.level.warn": "Achtung",
				"health.level.skipped": "Nicht geprüft",
				"health.level.fail": "Anomalie",
				"health.priority.high": "Priorität",
				"health.gate.generation": "Generations-Artefakt",
				"health.gate.log-integrity": "Protokoll-Integrität",
				"health.gate.projection-cache": "Projektions-Cache",
				"health.gate.lossless-json": "Verlustfreies JSON",
				"health.gate.cold-read": "Fortsetzbarkeit",
				"health.gate.source-kind": "Plugin-Signatur",
				"health.attribution": "Zugehörigkeit",
				"health.field": "Feld",
				"health.unknownOwner": "Zugehörigkeit unbekannt",
				"health.phase.checkup": "1) Untersuchung",
				"health.phase.prescribe": "2) Rezept",
				"health.phase.discharge": "3) Entlassung",
				"health.repair": "Umkehrbaren Eingriff ausführen",
				"health.repairing": "Eingriff läuft…",
				"health.sourceMigrate": "Alt-Signaturen umwandeln",
				"health.sourceMigrating": "Umwandlung…",
				"health.sourceMigrated": "{n} Zeilen Alt-Signaturen umgewandelt (Sicherung: {backup})",
				"health.sourceMigrateNone": "Keine umzuwandelnden Alt-Signatur-Zeilen",
				"health.sourceMigrateFail": "Umwandlung fehlgeschlagen: {error}",
				"health.before": "Vorher",
				"health.after": "Nachher",
				"health.quarantined": "Projektions-Cache-Datensatz in Quarantäne (faltet nach einem DSH-Neustart neu)",
				"health.commands": "Ausführbare Befehle",
				"health.copy": "Kopieren",
				"health.copied": "Kopiert",
				"health.detail": "Details anzeigen",
				"health.back": "Zurück zur Liste",
				"health.cache.hint": "Ergebnis aus dem Cache · {ago}",
				"health.cache.refresh": "Aktualisieren",
				"health.cache.corpusChanged": "Korpus geändert ({was} → {now}); Aktualisierung empfohlen",
				"health.ago.justNow": "gerade eben",
				"health.ago.minutes": "vor {n} Min",
				"health.ago.hours": "vor {n} Std",
				"health.ago.days": "vor {n} Tg"
			},
			it: {
				"card.title": "Amministratore di sessione",
				"card.desc": "File della cronologia · Controllo di salute",
				"card.enabled": "Abilita l’amministratore di sessione",
				"card.enabled.desc": "Se disattivato, non registra alcuna API e la voce nella barra laterale scompare del tutto.",
				"card.history": "File della cronologia delle sessioni",
				"card.history.desc": "Consultazione e pulizia degli archivi (Casa di riposo). Se disattivato, non registra API di cronologia e non rende questa scheda.",
				"card.health": "Controllo di salute",
				"card.health.desc": "Visita → Prescrizione → Dimissione. Se disattivato, non registra API di controllo e non rende questa scheda.",
				"card.readonly": "Questa sessione non può modificare le impostazioni (montaggio in sola lettura).",
				"card.unavailable": "Servizio di impostazioni non disponibile; impossibile leggere la configurazione.",
				"family.title": "Impostazioni del plugin Screwdriver",
				"panel.title": "Amministratore di sessione",
				"panel.tab.history": "Casa di riposo",
				"panel.tab.health": "Visita",
				"panel.close": "Chiudi",
				"panel.untitled": "(senza titolo)",
				"history.loading": "Lettura dell’elenco degli archivi…",
				"history.empty": "L’insieme degli archivi è vuoto.",
				"history.edit": "Modifica",
				"history.done": "Fatto",
				"history.selectAll": "Seleziona tutto",
				"history.unselectAll": "Deseleziona tutto",
				"history.unarchive": "Rimuovi lo stato di archivio ({n})",
				"history.unarchiving": "Rimozione dell’archivio…",
				"history.purge": "Elimina i file archiviati ({n}) · libera {size}",
				"history.purging": "Eliminazione…",
				"history.editingHint": "Modalità modifica: seleziona le sessioni, poi scegli uno dei due — «Rimuovi lo stato di archivio» le toglie solo dall’array ufficiale degli archivi (reversibile; dopo un riavvio tornano nella barra laterale); «Elimina i file archiviati» cancella davvero la trascrizione e la cache di proiezione dal disco (irreversibile).",
				"history.restartHint": "Rimossi {removed} id dall’array degli archivi ({remaining} rimanenti). **Riavvia subito DSH**: finché l’host non è terminato, qualsiasi modifica ad archivi o workspace riscrive l’intera istantanea in memoria nel file e annulla l’operazione.",
				"history.pendingRestart": "Nella memoria dell’host ci sono ancora {n} archivi attivi: l’elenco segue il file di archiviazione (non ci sono più), ma le loro sessioni restano nascoste nella barra laterale finché DSH non viene riavviato.",
				"history.count": "{n} voci · {size} occupati",
				"history.size": "trascrizione {t} · cache {c}",
				"history.sizeUnknown": "nessun elemento su disco",
				"history.source.registry": "Origine: registro degli archivi dell’host",
				"history.source.storage-file": "Origine: file di archiviazione",
				"history.source.none": "L’insieme degli archivi è illeggibile da entrambe le origini",
				"history.confirmUnarchive": "Rimuovere lo stato di archivio di queste {n} sessioni?\n\n{summary}\n\nViene modificato solo l’array degli archivi (backup automatico); nulla su disco viene toccato. Dopo un riavvio di DSH queste sessioni tornano nei rispettivi workspace.",
				"history.confirmPurge": "Eliminare i file su disco di queste {n} sessioni archiviate?\n\n{summary}\n\nVerranno liberati circa {size} in totale.\nVerranno eliminati: la directory delle trascrizioni (comprese le copie in formato vecchio) e la cache di proiezione per singolo elemento, e la rimozione dall’array degli archivi e dalle tabelle dei membri del workspace.\n\n**Questa operazione è irreversibile: le sessioni non saranno recuperabili.**",
				"history.purgeResult": "Eliminate {purged} sessioni archiviate, liberati {size}. Riavvia DSH perché scompaiano del tutto.",
				"history.purgePartial": "Eliminate {purged}, liberati {size}; {failed} fallite (vedi dettagli sotto).",
				"history.purgeFailures": "Dettagli dei fallimenti",
				"health.scan": "Avvia il controllo",
				"health.scanning": "Controllo in corso…",
				"health.progress": "{done}/{total} · {sec}s impiegati",
				"health.empty": "Nessuna sessione problematica trovata.",
				"health.clean": "Tutti i controlli superati.",
				"health.level.ok": "ok",
				"health.level.warn": "attenzione",
				"health.level.skipped": "Non controllato",
				"health.level.fail": "anomalia",
				"health.priority.high": "Priorità",
				"health.gate.generation": "Artefatto di generazione",
				"health.gate.log-integrity": "Integrità dei log",
				"health.gate.projection-cache": "Cache di proiezione",
				"health.gate.lossless-json": "JSON senza perdita",
				"health.gate.cold-read": "Continuità",
				"health.gate.source-kind": "Firma del plugin",
				"health.attribution": "Appartenenza",
				"health.field": "Campo",
				"health.unknownOwner": "appartenenza sconosciuta",
				"health.phase.checkup": "1) Visita",
				"health.phase.prescribe": "2) Prescrizione",
				"health.phase.discharge": "3) Dimissione",
				"health.repair": "Esegui intervento reversibile",
				"health.repairing": "Intervento…",
				"health.sourceMigrate": "Converti firme ereditate",
				"health.sourceMigrating": "Conversione…",
				"health.sourceMigrated": "Convertite {n} righe di firme ereditate (backup: {backup})",
				"health.sourceMigrateNone": "Nessuna riga di firma ereditata da convertire",
				"health.sourceMigrateFail": "Conversione fallita: {error}",
				"health.before": "Prima",
				"health.after": "Dopo",
				"health.quarantined": "Record della cache di proiezione messo in quarantena (si ripiega dopo un riavvio di DSH)",
				"health.commands": "Comandi eseguibili",
				"health.copy": "Copia",
				"health.copied": "Copiato",
				"health.detail": "Vedi dettagli",
				"health.back": "Torna all’elenco",
				"health.cache.hint": "Risultato dalla cache · {ago}",
				"health.cache.refresh": "Aggiorna",
				"health.cache.corpusChanged": "Corpo testuale modificato ({was} → {now}); aggiornamento consigliato",
				"health.ago.justNow": "proprio ora",
				"health.ago.minutes": "{n} min fa",
				"health.ago.hours": "{n} h fa",
				"health.ago.days": "{n} g fa"
			},
			ru: {
				"card.title": "Распорядитель сессий",
				"card.desc": "Файлы истории · Проверка здоровья",
				"card.enabled": "Включить распорядителя сессий",
				"card.enabled.desc": "При выключении не регистрируется ни один API, и пункт боковой панели полностью исчезает.",
				"card.history": "Файлы истории сессий",
				"card.history.desc": "Просмотр и очистка архивов (Пансионат). При выключении не регистрируются API истории и эта вкладка не отображается.",
				"card.health": "Проверка здоровья",
				"card.health.desc": "Осмотр → Рецепт → Выписка. При выключении не регистрируются API проверки и эта вкладка не отображается.",
				"card.readonly": "Эта сессия не может изменять настройки (монтирование только для чтения).",
				"card.unavailable": "Сервис настроек недоступен; конфигурацию невозможно прочитать.",
				"family.title": "Настройки плагинов Screwdriver",
				"panel.title": "Распорядитель сессий",
				"panel.tab.history": "Пансионат",
				"panel.tab.health": "Осмотр",
				"panel.close": "Закрыть",
				"panel.untitled": "(без названия)",
				"history.loading": "Чтение списка архивов…",
				"history.empty": "Множество архивов пусто.",
				"history.edit": "Изменить",
				"history.done": "Готово",
				"history.selectAll": "Выбрать все",
				"history.unselectAll": "Снять выбор",
				"history.unarchive": "Снять статус архива ({n})",
				"history.unarchiving": "Снятие с архива…",
				"history.purge": "Удалить файлы архива ({n}) · освободить {size}",
				"history.purging": "Удаление…",
				"history.editingHint": "Режим правки: отметьте сессии, затем выберите одно — «Снять статус архива» лишь убирает их из официального массива архивов (обратимо; после перезапуска вернутся в боковую панель); «Удалить файлы архива» реально стирает транскрипт и кэш проекций с диска (необратимо).",
				"history.restartHint": "Из массива архивов удалено {removed} id (осталось {remaining}). **Немедленно перезапустите DSH**: пока хост не завершился, любые изменения архивов или рабочего пространства перезаписывают весь снимок из памяти обратно в файл, и эта операция будет отменена.",
				"history.pendingRestart": "В памяти хоста ещё {n} архивов остаются действительными: список следует файлу хранения (их уже нет), но соответствующие сессии скрыты из боковой панели до перезапуска DSH.",
				"history.count": "Всего {n} · занято {size}",
				"history.size": "транскрипт {t} · кэш {c}",
				"history.sizeUnknown": "на диске сущностей нет",
				"history.source.registry": "Источник: реестр архивов хоста",
				"history.source.storage-file": "Источник: файл хранения",
				"history.source.none": "Множество архивов не читается из обоих источников",
				"history.confirmUnarchive": "Снять статус архива у этих {n} сессий?\n\n{summary}\n\nРедактируется только массив архивов (автоматическое резервное копирование); файлы на диске не трогаются. После перезапуска DSH эти сессии вернутся в свои рабочие пространства.",
				"history.confirmPurge": "Удалить файлы на диске у этих {n} архивированных сессий?\n\n{summary}\n\nВсего освободится около {size}.\nБудут удалены: каталог транскриптов (включая копии старого формата) и поэлементный кэш проекций, а также удаление из массива архивов и таблиц участников рабочего пространства.\n\n**Эта операция необратима — сессии невозможно будет восстановить.**",
				"history.purgeResult": "Удалено {purged} архивированных сессий, освобождено {size}. Перезапустите DSH, чтобы они исчезли окончательно.",
				"history.purgePartial": "Удалено {purged}, освобождено {size}; {failed} с ошибками (подробности ниже).",
				"history.purgeFailures": "Подробности ошибок",
				"health.scan": "Начать осмотр",
				"health.scanning": "Идёт осмотр…",
				"health.progress": "{done}/{total} · прошло {sec}с",
				"health.empty": "Проблемных сессий не найдено.",
				"health.clean": "Все проверки пройдены.",
				"health.level.ok": "норма",
				"health.level.warn": "внимание",
				"health.level.skipped": "не проверено",
				"health.level.fail": "аномалия",
				"health.priority.high": "Приоритет",
				"health.gate.generation": "Артефакт поколения",
				"health.gate.log-integrity": "Целостность журнала",
				"health.gate.projection-cache": "Кэш проекций",
				"health.gate.lossless-json": "JSON без потерь",
				"health.gate.cold-read": "Возможность продолжения",
				"health.gate.source-kind": "Подпись плагина",
				"health.attribution": "Принадлежность",
				"health.field": "Поле",
				"health.unknownOwner": "принадлежность неизвестна",
				"health.phase.checkup": "1) Осмотр",
				"health.phase.prescribe": "2) Рецепт",
				"health.phase.discharge": "3) Выписка",
				"health.repair": "Выполнить обратимое воздействие",
				"health.repairing": "Воздействие…",
				"health.sourceMigrate": "Преобразовать старые подписи",
				"health.sourceMigrating": "Преобразование…",
				"health.sourceMigrated": "Преобразовано {n} строк старых подписей (резервная копия: {backup})",
				"health.sourceMigrateNone": "Нет строк старых подписей для преобразования",
				"health.sourceMigrateFail": "Ошибка преобразования: {error}",
				"health.before": "До",
				"health.after": "После",
				"health.quarantined": "Запись кэша проекций помещена в карантин (пересоберётся после перезапуска DSH)",
				"health.commands": "Выполнимые команды",
				"health.copy": "Копировать",
				"health.copied": "Скопировано",
				"health.detail": "Показать подробности",
				"health.back": "К списку",
				"health.cache.hint": "Результат из кэша · {ago}",
				"health.cache.refresh": "Обновить",
				"health.cache.corpusChanged": "Корпус изменился ({was} → {now}); рекомендуется обновление",
				"health.ago.justNow": "только что",
				"health.ago.minutes": "{n} мин назад",
				"health.ago.hours": "{n} ч назад",
				"health.ago.days": "{n} дн назад"
			},
			es: {
				"card.title": "Mayordomo de sesión",
				"card.desc": "Archivos de historial · Comprobación de salud",
				"card.enabled": "Activar el mayordomo de sesión",
				"card.enabled.desc": "Al desactivarlo no se registra ninguna API y la entrada de la barra lateral desaparece por completo.",
				"card.history": "Archivos de historial de sesión",
				"card.history.desc": "Visualización y limpieza del archivo (Residencia). Al desactivarlo no se registran rutas de historial ni se muestra esa pestaña.",
				"card.health": "Comprobación de salud",
				"card.health.desc": "Revisión → Receta → Alta. Al desactivarlo no se registran rutas de revisión ni se muestra esa pestaña.",
				"card.readonly": "Esta sesión no puede modificar la configuración (montaje de solo lectura).",
				"card.unavailable": "Servicio de configuración no disponible; no se puede leer la configuración.",
				"family.title": "Ajustes del plugin Screwdriver",
				"panel.title": "Mayordomo de sesión",
				"panel.tab.history": "Residencia",
				"panel.tab.health": "Revisión",
				"panel.close": "Cerrar",
				"panel.untitled": "(sin título)",
				"history.loading": "Leyendo la lista de archivos…",
				"history.empty": "El conjunto de archivos está vacío.",
				"history.edit": "Editar",
				"history.done": "Listo",
				"history.selectAll": "Seleccionar todo",
				"history.unselectAll": "Deseleccionar todo",
				"history.unarchive": "Quitar el estado de archivo ({n})",
				"history.unarchiving": "Quitando del archivo…",
				"history.purge": "Purgar archivos del archivo ({n}) · liberar {size}",
				"history.purging": "Purgando…",
				"history.editingHint": "Modo edición: marca sesiones y elige una de dos — «Quitar el estado de archivo» solo las retira de la matriz oficial de archivos (reversible; vuelven a la barra lateral tras reiniciar); «Purgar archivos del archivo» borra de verdad la transcripción y la caché de proyección del disco (irreversible).",
				"history.restartHint": "Se retiraron {removed} id de la matriz de archivos (quedan {remaining}). **Reinicia DSH ahora**: hasta que el host se cierre, cualquier cambio en archivos o espacio de trabajo reescribe toda la instantánea en memoria al archivo y deshace esta operación.",
				"history.pendingRestart": "En la memoria del host aún hay {n} archivos vigentes: la lista sigue el archivo de almacenamiento (ya no están), pero sus sesiones quedan ocultas de la barra lateral hasta reiniciar DSH.",
				"history.count": "{n} en total · {size} ocupados",
				"history.size": "transcripción {t} · caché {c}",
				"history.sizeUnknown": "sin entidad en el disco",
				"history.source.registry": "Origen: registro de archivos del host",
				"history.source.storage-file": "Origen: archivo de almacenamiento",
				"history.source.none": "El conjunto de archivos no se puede leer desde ninguno de los dos orígenes",
				"history.confirmUnarchive": "¿Quitar el estado de archivo de estas {n} sesiones?\n\n{summary}\n\nSolo se edita la matriz de archivos (copia de seguridad automática); no se toca nada en el disco. Tras reiniciar DSH, estas sesiones vuelven a sus espacios de trabajo.",
				"history.confirmPurge": "¿Purgar los archivos en disco de estas {n} sesiones archivadas?\n\n{summary}\n\nSe liberarán unos {size} en total.\nSe borrarán: el directorio de transcripciones (incluidas las copias de formato antiguo) y la caché de proyección por elemento, y se retirarán de la matriz de archivos y de las tablas de miembros del espacio de trabajo.\n\n**Esta operación es irreversible; las sesiones no se podrán recuperar.**",
				"history.purgeResult": "Purgadas {purged} sesiones archivadas, liberados {size}. Reinicia DSH para que desaparezcan por completo.",
				"history.purgePartial": "Purgadas {purged}, liberados {size}; {failed} fallidas (ver detalles abajo).",
				"history.purgeFailures": "Detalles de los fallos",
				"health.scan": "Iniciar revisión",
				"health.scanning": "Revisando…",
				"health.progress": "{done}/{total} · {sec}s transcurridos",
				"health.empty": "No se encontró ninguna sesión problemática.",
				"health.clean": "Todas las comprobaciones pasaron.",
				"health.level.ok": "correcto",
				"health.level.warn": "atención",
				"health.level.skipped": "No comprobado",
				"health.level.fail": "anomalía",
				"health.priority.high": "Prioridad",
				"health.gate.generation": "Artefacto de generación",
				"health.gate.log-integrity": "Integridad del registro",
				"health.gate.projection-cache": "Caché de proyección",
				"health.gate.lossless-json": "JSON sin pérdida",
				"health.gate.cold-read": "Continuidad",
				"health.gate.source-kind": "Firma del plugin",
				"health.attribution": "Titular",
				"health.field": "Campo",
				"health.unknownOwner": "titular desconocido",
				"health.phase.checkup": "1) Revisión",
				"health.phase.prescribe": "2) Receta",
				"health.phase.discharge": "3) Alta",
				"health.repair": "Aplicar reparación reversible",
				"health.repairing": "Reparando…",
				"health.sourceMigrate": "Convertir firmas heredadas",
				"health.sourceMigrating": "Convirtiendo…",
				"health.sourceMigrated": "Convertidas {n} filas de firmas heredadas (copia de seguridad: {backup})",
				"health.sourceMigrateNone": "No hay filas de firmas heredadas que convertir",
				"health.sourceMigrateFail": "Conversión fallida: {error}",
				"health.before": "Antes",
				"health.after": "Después",
				"health.quarantined": "Registro de la caché de proyección puesto en cuarentena (se repliega tras reiniciar DSH)",
				"health.commands": "Comandos ejecutables",
				"health.copy": "Copiar",
				"health.copied": "Copiado",
				"health.detail": "Ver detalles",
				"health.back": "Volver a la lista",
				"health.cache.hint": "Resultado desde la caché · {ago}",
				"health.cache.refresh": "Actualizar",
				"health.cache.corpusChanged": "El corpus cambió ({was} → {now}); se recomienda actualizar",
				"health.ago.justNow": "ahora mismo",
				"health.ago.minutes": "hace {n} min",
				"health.ago.hours": "hace {n} h",
				"health.ago.days": "hace {n} d"
			}
		};
		/** 字典查找（缺 key 时回退到内置 zh，再回退 key 本身）。 */
		function translate(t, key, params) {
			if (t !== void 0) try {
				return t(key, params);
			} catch {}
			return format(zh$1[key] ?? key, params);
		}
		/** 极简 `{name}` 替换。 */
		function format(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
		}
		//#endregion
		//#region src/client/card.tsx
		/**
		* 设置卡（插件配置行）：一个可折叠抽屉 —— 会话历史文件 / 健康检查。
		*
		* **chrome 必须自己渲染**：宿主不为贡献卡提供任何外壳，标题、说明、
		* 展开/收起全归插件自己所有。早期版本只渲染裸行，与同分区其它插件
		* 的抽屉形态不一致，还让 `card.title` / `card.desc` 成为死文案。
		*
		* 读写走 configForms（`configForms.get(STEWARD_ENTRY_ID)`，以本插件 entry 为键；
		* 旧宿主回退 settingsScope 绑定）的显式 `set`。0.1.7 起本卡挂在插件族共用
		* 设置节（`dsh-family.tab`，dsh-thinking-levels 顶级「起子插件设置」节声明）里，
		* 与同节其它抽屉一样默认展开。
		*/
		/** 一行设置项。 */
		function Row$1(props) {
			return (0, react.createElement)("div", { className: "dss_setRow" }, [(0, react.createElement)("div", {
				key: "text",
				className: "dss_setText"
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dss_setTitle"
			}, props.title), props.desc !== void 0 && (0, react.createElement)("span", {
				key: "d",
				className: "dss_setDesc"
			}, props.desc)]), (0, react.createElement)("div", { key: "ctl" }, props.control)]);
		}
		/** 一个布尔开关（原生 checkbox 语义，样式由本插件 CSS 提供）。 */
		function Toggle$1(props) {
			return (0, react.createElement)("label", { className: `dss_toggle${props.checked ? " dss_toggleOn" : ""}` }, [(0, react.createElement)("input", {
				key: "i",
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled === true,
				onChange: (event) => {
					props.onChange(event.target.checked);
				}
			}), (0, react.createElement)("span", {
				key: "s",
				className: "dss_toggleTrack"
			}, (0, react.createElement)("span", { className: "dss_toggleKnob" }))]);
		}
		/** 抽屉头：标题 + 说明 + chevron，整块可点。 */
		function Header(props) {
			return (0, react.createElement)("button", {
				key: "head",
				type: "button",
				className: "dss_setHead",
				"aria-expanded": props.open,
				onClick: props.onToggle
			}, [(0, react.createElement)("span", {
				key: "text",
				className: "dss_setHeadText"
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dss_setCardTitle"
			}, translate(props.t, "card.title")), (0, react.createElement)("span", {
				key: "d",
				className: "dss_setCardDesc"
			}, translate(props.t, "card.desc"))]), (0, react.createElement)("svg", {
				key: "chev",
				className: "dss_setChev",
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				"aria-hidden": true
			}, (0, react.createElement)("path", {
				d: "M4 6l4 4 4-4",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}))]);
		}
		/** 插件设置卡主体（抽屉）。默认展开，family 设置节内直接呈现完整面板。 */
		function StewardSettingsCard({ t, scope }) {
			const snapshot = (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot());
			const [open, setOpen] = (0, react.useState)(true);
			const value = snapshot.value ?? {};
			const writable = snapshot.writable;
			const rows = [];
			if (snapshot.status === "unavailable") rows.push((0, react.createElement)("div", {
				key: "unavailable",
				className: "dss_setDesc"
			}, translate(t, "card.unavailable")));
			else {
				rows.push((0, react.createElement)(Row$1, {
					key: "enabled",
					title: translate(t, "card.enabled"),
					desc: translate(t, "card.enabled.desc"),
					control: (0, react.createElement)(Toggle$1, {
						checked: value.enabled ?? DEFAULT_CONFIG.enabled,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("enabled", checked);
						}
					})
				}), (0, react.createElement)(Row$1, {
					key: "history",
					title: translate(t, "card.history"),
					desc: translate(t, "card.history.desc"),
					control: (0, react.createElement)(Toggle$1, {
						checked: value.historyFiles ?? DEFAULT_CONFIG.historyFiles,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("historyFiles", checked);
						}
					})
				}), (0, react.createElement)(Row$1, {
					key: "health",
					title: translate(t, "card.health"),
					desc: translate(t, "card.health.desc"),
					control: (0, react.createElement)(Toggle$1, {
						checked: value.healthCheck ?? DEFAULT_CONFIG.healthCheck,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("healthCheck", checked);
						}
					})
				}));
				if (!writable) rows.push((0, react.createElement)("div", {
					key: "ro",
					className: "dss_setDesc"
				}, translate(t, "card.readonly")));
			}
			return (0, react.createElement)("div", { className: `dss_setCard${open ? " dss_setCardOpen" : ""}` }, [(0, react.createElement)(Header, {
				key: "head",
				t,
				open,
				onToggle: () => {
					setOpen((current) => !current);
				}
			}), open && (0, react.createElement)("div", {
				key: "body",
				className: "dss_setBody"
			}, rows)]);
		}
		//#endregion
		//#region src/client/host-api.ts
		/**
		* 客户端 host 调用助手：一切经 fenced `/session-steward/api/<method>` 路由，
		* 不 value-import 任何官方包（与 dsh-session-search-toggle 的 host-api.ts 同范式，
		* 仅把路由前缀换成会话管家自己的）。
		*/
		/** 单次 host 调用超时（导入类大响应可单独放宽）。 */
		const FETCH_TIMEOUT$1 = 2e4;
		/** POST 一个 JSON body，返回整条记录。 */
		function callHostAny$1(method, body, timeout = FETCH_TIMEOUT$1) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/session-steward/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		//#endregion
		//#region src/client/history-panel.tsx
		/**
		* 养老院（会话历史文件）面板 —— 自 dsh-session-search-toggle `src/client/archive-panel.tsx`
		* **迁入**并适配到本包的方法名。
		*
		* 与迁移前的关键差异（**两个操作刻意分开，不可互换**）：
		*
		* | 操作 | 路由 | 改什么 | 可逆 |
		* |---|---|---|---|
		* | 取消归档状态 | `session-history-prune` | 只改归档数组 | ✅ 重启后会话回到侧边栏 |
		* | 清理归档文件 | `session-history-purge` | **真删**转录目录 + 投影缓存 + 两处 id | ❌ 不可逆 |
		*
		* 「删除」一词在本面板**不存在** —— 旧文案承诺「删除」却只改了个数组，
		* 是导致「点了确认没反应」那类误判的一部分。
		* 体积**按行**显示（实测单条可从 0 到 23 MB，报一个总量没有意义），按钮上给所选小计。
		*/
		/** 人类可读体积。 */
		function fmtSize(bytes) {
			if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
			const units = [
				"B",
				"KB",
				"MB",
				"GB",
				"TB"
			];
			let value = bytes;
			let unit = 0;
			while (value >= 1024 && unit < units.length - 1) {
				value /= 1024;
				unit++;
			}
			return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
		}
		/** 养老院面板。 */
		function HistoryPanel({ t, onClose }) {
			const [items, setItems] = (0, react.useState)(null);
			const [source, setSource] = (0, react.useState)("");
			const [degraded, setDegraded] = (0, react.useState)("");
			const [pendingRestart, setPendingRestart] = (0, react.useState)(0);
			const [error, setError] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [busy, setBusy] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			/** 清理失败明细（逐条）；空数组表示无失败。 */
			const [failures, setFailures] = (0, react.useState)([]);
			const [editing, setEditing] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				setError(null);
				callHostAny$1("session-history-list", {}).then((res) => {
					if (cancelled) return;
					if (res.ok === true && Array.isArray(res.items)) {
						setItems(res.items);
						setSource(typeof res.source === "string" ? res.source : "");
						setDegraded(typeof res.degraded === "string" ? res.degraded : "");
						setPendingRestart(typeof res.pendingRestart === "number" ? res.pendingRestart : 0);
					} else setError(res.error ?? "读取归档列表失败");
				});
				return () => {
					cancelled = true;
				};
			}, [attempt]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const toggleRow = (sessionId) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(sessionId)) next.delete(sessionId);
					else next.add(sessionId);
					return next;
				});
			};
			/** 进出编辑模式；离开时清空选择。 */
			const toggleEditing = () => {
				setEditing((prev) => !prev);
				setSelected(/* @__PURE__ */ new Set());
				setNote(null);
				setFailures([]);
			};
			const toggleAll = () => {
				setSelected((prev) => prev.size === (items?.length ?? 0) ? /* @__PURE__ */ new Set() : new Set((items ?? []).map((item) => item.sessionId)));
			};
			const selectedRows = (items ?? []).filter((item) => selected.has(item.sessionId));
			const selectedBytes = selectedRows.reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0);
			const totalBytes = (items ?? []).reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0);
			/** 确认弹窗里的逐条摘要（清理时带体积，取消归档时不带）。 */
			const summarise = (rows, withSize) => {
				const lines = rows.slice(0, 5).map((row) => {
					const label = row.title || translate(t, "panel.untitled");
					const size = fmtSize(row.bytes + row.cacheBytes);
					return withSize ? `· ${label} — ${size}` : `· ${label}`;
				});
				if (rows.length > 5) lines.push(`… 共 ${rows.length} 个`);
				return lines.join("\n");
			};
			const confirm = (message) => typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(message) : false;
			/** 提交一次操作：确认 → 调用 → 刷新列表（列表以存储文件为准，因此立刻可见变化）。 */
			const run = (kind, method, confirmText) => {
				const rows = selectedRows;
				if (rows.length === 0) return;
				if (!confirm(confirmText)) return;
				setBusy(kind);
				setNote(null);
				setFailures([]);
				callHostAny$1(method, { sessionIds: rows.map((row) => row.sessionId) }, 6e4).then((res) => {
					if (res.ok === true) {
						if (kind === "unarchive") setNote(translate(t, "history.restartHint", {
							removed: res.removed ?? rows.length,
							remaining: res.remaining ?? "?"
						}));
						else {
							const freed = fmtSize(res.freedBytes ?? 0);
							const failed = res.failures?.length ?? 0;
							setNote(failed === 0 ? translate(t, "history.purgeResult", {
								purged: res.purged ?? rows.length,
								size: freed
							}) : translate(t, "history.purgePartial", {
								purged: res.purged ?? rows.length,
								size: freed,
								failed
							}));
							setFailures(res.failures ?? []);
						}
						setSelected(/* @__PURE__ */ new Set());
						setAttempt((n) => n + 1);
					} else setNote(res.error ?? "操作失败");
				}).catch((err) => setNote(`操作失败：${String(err instanceof Error ? err.message : err)}`)).finally(() => setBusy(null));
			};
			const unarchiveSelected = () => {
				run("unarchive", "session-history-prune", translate(t, "history.confirmUnarchive", {
					n: selectedRows.length,
					summary: summarise(selectedRows, false)
				}));
			};
			const purgeSelected = () => {
				run("purge", "session-history-purge", translate(t, "history.confirmPurge", {
					n: selectedRows.length,
					summary: summarise(selectedRows, true),
					size: fmtSize(selectedBytes)
				}));
			};
			const children = [];
			if (error !== null) children.push((0, react.createElement)("div", {
				key: "err",
				className: "dss_error"
			}, [(0, react.createElement)("div", { key: "msg" }, error === "请求超时" ? "读取归档列表超时：Host 可能正忙，稍后重试。" : error), (0, react.createElement)("button", {
				key: "retry",
				type: "button",
				className: "dss_actBtn",
				style: { marginTop: "6px" },
				onClick: () => {
					setAttempt((n) => n + 1);
				}
			}, "重试")]));
			else if (items === null) children.push((0, react.createElement)("div", {
				key: "loading",
				className: "dss_status"
			}, translate(t, "history.loading")));
			else if (items.length === 0) children.push((0, react.createElement)("div", {
				key: "empty",
				className: "dss_empty"
			}, translate(t, "history.empty")));
			else {
				const allSelected = selected.size === items.length;
				if (editing) children.push((0, react.createElement)("div", {
					key: "manage",
					className: "dss_btnRow",
					style: { padding: "4px 10px 0" }
				}, [
					(0, react.createElement)("button", {
						key: "all",
						type: "button",
						className: "dss_actBtn",
						onClick: toggleAll
					}, allSelected ? translate(t, "history.unselectAll") : translate(t, "history.selectAll")),
					(0, react.createElement)("button", {
						key: "unarchive",
						type: "button",
						className: "dss_actBtn",
						disabled: busy !== null || selected.size === 0,
						onClick: unarchiveSelected
					}, busy === "unarchive" ? translate(t, "history.unarchiving") : translate(t, "history.unarchive", { n: selected.size })),
					(0, react.createElement)("button", {
						key: "purge",
						type: "button",
						className: "dss_actBtn dss_dangerBtn",
						disabled: busy !== null || selected.size === 0,
						onClick: purgeSelected
					}, busy === "purge" ? translate(t, "history.purging") : translate(t, "history.purge", {
						n: selected.size,
						size: fmtSize(selectedBytes)
					}))
				]));
				children.push((0, react.createElement)("ul", {
					key: "list",
					className: "dss_list",
					role: "list",
					"aria-label": translate(t, "history.source.registry")
				}, items.map((item) => (0, react.createElement)("li", {
					key: item.sessionId,
					className: "dss_row"
				}, [
					editing && (0, react.createElement)("label", {
						key: "sel",
						className: "dss_check"
					}, [(0, react.createElement)("input", {
						type: "checkbox",
						checked: selected.has(item.sessionId),
						onChange: () => {
							toggleRow(item.sessionId);
						}
					})]),
					(0, react.createElement)("span", {
						key: "t",
						className: "dss_rowTitle"
					}, [(0, react.createElement)("span", {
						key: "x",
						className: "dss_titleText"
					}, item.title || translate(t, "panel.untitled")), item.updatedAt > 0 && (0, react.createElement)("span", {
						key: "tag",
						className: "dss_tag"
					}, fmtTime$2(item.updatedAt))]),
					(0, react.createElement)("span", {
						key: "size",
						className: "dss_meta dss_size"
					}, item.bytes + item.cacheBytes > 0 ? translate(t, "history.size", {
						t: fmtSize(item.bytes),
						c: fmtSize(item.cacheBytes)
					}) : translate(t, "history.sizeUnknown")),
					item.cwd !== "" && (0, react.createElement)("span", {
						key: "c",
						className: "dss_meta"
					}, item.cwd),
					(0, react.createElement)("span", {
						key: "id",
						className: "dss_meta dss_uuid"
					}, item.sessionId)
				]))));
			}
			return (0, react.createElement)("div", { className: "dss_tabBody" }, [
				note !== null && (0, react.createElement)("div", {
					key: "note",
					className: "dss_status"
				}, note),
				failures.length > 0 && (0, react.createElement)("div", {
					key: "fail",
					className: "dss_status dss_error"
				}, [(0, react.createElement)("div", { key: "h" }, translate(t, "history.purgeFailures")), ...failures.slice(0, 10).map((failure, index) => (0, react.createElement)("div", {
					key: `f${index}`,
					className: "dss_meta"
				}, `${failure.sessionId.slice(0, 22)}… — ${failure.reason}`))]),
				editing && (0, react.createElement)("div", {
					key: "hint",
					className: "dss_status"
				}, translate(t, "history.editingHint")),
				degraded !== "" && (0, react.createElement)("div", {
					key: "degraded",
					className: "dss_status dss_warnText"
				}, degraded),
				pendingRestart > 0 && (0, react.createElement)("div", {
					key: "pending",
					className: "dss_status dss_warnText"
				}, translate(t, "history.pendingRestart", { n: pendingRestart })),
				source !== "" && (0, react.createElement)("div", {
					key: "source",
					className: "dss_metaLine"
				}, translate(t, source === "registry" ? "history.source.registry" : source === "storage-file" ? "history.source.storage-file" : "history.source.none")),
				items !== null && error === null && (0, react.createElement)("div", {
					key: "count",
					className: "dss_metaLine"
				}, translate(t, "history.count", {
					n: items.length,
					size: fmtSize(totalBytes)
				})),
				(0, react.createElement)("div", {
					key: "headBtns",
					className: "dss_btnRow"
				}, [(0, react.createElement)("button", {
					key: "edit",
					type: "button",
					className: `dss_actBtn${editing ? " dss_editActive" : ""}`,
					onClick: toggleEditing
				}, editing ? translate(t, "history.done") : translate(t, "history.edit"))]),
				...children
			]);
		}
		/** 时间格式化（与迁移前一致）。 */
		function fmtTime$2(ms) {
			if (!ms || typeof ms !== "number") return "";
			try {
				const date = new Date(ms);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
				const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
				if (sameDay) return time;
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
			} catch {
				return "";
			}
		}
		//#endregion
		//#region src/client/health-panel.tsx
		/**
		* 体检面板：体检（五门）→ 处方（命令清单）→ 出院（可逆处置 + before/after 对照）。
		*
		* 三态流转完全由 host 侧报告驱动，客户端只做展示与触发；重型动作都在 host，
		* 渲染周期内不发同步重活。
		*/
		const GATE_LABEL = {
			"generation": "health.gate.generation",
			"log-integrity": "health.gate.log-integrity",
			"projection-cache": "health.gate.projection-cache",
			"lossless-json": "health.gate.lossless-json",
			"cold-read": "health.gate.cold-read",
			"source-kind": "health.gate.source-kind"
		};
		const LEVEL_LABEL = {
			ok: "health.level.ok",
			warn: "health.level.warn",
			skipped: "health.level.skipped",
			fail: "health.level.fail"
		};
		/**
		* 单批扫描的会话数。
		*
		* 宿主侧 `scanSessions` 是同步循环，一次批太大就长时间占住事件循环、界面全无反馈。
		* 小批次连续调用把控制权交回客户端：每批之间有真实的进度与计时，且宿主无需持有
		* 跨请求状态（见 host/health/scan.ts 的 offset 语义）。
		*/
		const SCAN_BATCH = 5;
		/**
		* 把缓存生成时刻折成一个粗粒度的相对时间 key。
		*
		* 不引第三方 i18n/时间库：四档粒度足够表达「这是刚才的 / 是昨天的」，
		* 而这正是用户判断「要不要刷新」所需的全部信息。
		*/
		function relativeAgo(generatedAt, now) {
			const seconds = Math.max(0, Math.round((now - generatedAt) / 1e3));
			if (seconds < 60) return {
				key: "health.ago.justNow",
				n: 0
			};
			const minutes = Math.floor(seconds / 60);
			if (minutes < 60) return {
				key: "health.ago.minutes",
				n: minutes
			};
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return {
				key: "health.ago.hours",
				n: hours
			};
			return {
				key: "health.ago.days",
				n: Math.floor(hours / 24)
			};
		}
		/** 体检面板。 */
		function HealthPanel({ t, onClose }) {
			const [scanning, setScanning] = (0, react.useState)(false);
			const [findings, setFindings] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [repairing, setRepairing] = (0, react.useState)(false);
			const [migrating, setMigrating] = (0, react.useState)(false);
			/** 署名转换结果提示（一次性；点击转换或返回列表时清除）。 */
			const [migrateNote, setMigrateNote] = (0, react.useState)(null);
			const [discharge, setDischarge] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(null);
			/** 分批扫描进度：done = 已访问会话数，total = 语料总数（0 表示尚未拿到分母）。 */
			const [progress, setProgress] = (0, react.useState)(null);
			const [startedAt, setStartedAt] = (0, react.useState)(0);
			const [elapsedMs, setElapsedMs] = (0, react.useState)(0);
			/** 缓存命中时的元信息；非 null 即「当前列表来自缓存」，必须露出生成时间。 */
			const [cacheInfo, setCacheInfo] = (0, react.useState)(null);
			/** 相对时间的走字刻度：缓存提示里的「N 分钟前」需要自己更新。 */
			const [, setClockTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			(0, react.useEffect)(() => {
				callHostAny$1("session-health-scan", { resume: true }, 3e4).then((res) => {
					if (res.ok === true && res.cached === true) {
						setFindings(res.findings ?? []);
						setCacheInfo({
							generatedAt: res.generatedAt ?? 0,
							total: res.total ?? 0,
							currentTotal: res.currentTotal ?? res.total ?? 0
						});
					}
				});
			}, []);
			(0, react.useEffect)(() => {
				if (cacheInfo === null) return;
				const timer = setInterval(() => {
					setClockTick((tick) => tick + 1);
				}, 3e4);
				return () => {
					clearInterval(timer);
				};
			}, [cacheInfo]);
			(0, react.useEffect)(() => {
				if (!scanning || startedAt === 0) return;
				const timer = setInterval(() => {
					setElapsedMs(Date.now() - startedAt);
				}, 100);
				return () => {
					clearInterval(timer);
				};
			}, [scanning, startedAt]);
			const runScan = (options) => {
				const forceRefresh = options?.forceRefresh === true;
				setScanning(true);
				setError(null);
				setDetail(null);
				setDischarge(null);
				setMigrateNote(null);
				setFindings(null);
				setCacheInfo(null);
				setProgress({
					done: 0,
					total: 0
				});
				setStartedAt(Date.now());
				setElapsedMs(0);
				(async () => {
					const collected = [];
					let offset = 0;
					try {
						for (;;) {
							const res = await callHostAny$1("session-health-scan", {
								limit: SCAN_BATCH,
								offset,
								onlyProblems: true,
								...offset === 0 && !forceRefresh ? { resume: true } : {}
							}, 12e4);
							if (res.ok !== true) {
								setError(res.error ?? "体检失败");
								return;
							}
							if (res.cached === true) {
								setFindings(res.findings ?? []);
								setCacheInfo({
									generatedAt: res.generatedAt ?? 0,
									total: res.total ?? 0,
									currentTotal: res.currentTotal ?? res.total ?? 0
								});
								setProgress(null);
								return;
							}
							const total = res.total ?? 0;
							const scanned = res.scanned ?? 0;
							collected.push(...res.findings ?? []);
							offset += scanned;
							setProgress({
								done: offset,
								total
							});
							if (scanned === 0 || offset >= total) break;
						}
						setFindings(collected);
					} catch (err) {
						setError(String(err instanceof Error ? err.message : err));
					} finally {
						setScanning(false);
					}
				})();
			};
			/**
			* 把单会话的最新报告同步进列表。
			*
			* 宿主侧缓存已就地回写（见 index.ts 的 `cache?.patch`），客户端列表必须同步，
			* 否则退回列表时会看到已被处置的行还挂着旧档位。
			*/
			const reconcileRow = (next) => {
				setFindings((prev) => {
					if (prev === null) return prev;
					const index = prev.findIndex((item) => item.sessionId === next.sessionId);
					if (next.level === "ok") return index < 0 ? prev : prev.filter((item) => item.sessionId !== next.sessionId);
					return index < 0 ? [...prev, next] : prev.map((item) => item.sessionId === next.sessionId ? next : item);
				});
			};
			const openDetail = (sessionId) => {
				setError(null);
				setDischarge(null);
				setMigrateNote(null);
				callHostAny$1("session-health-session", { sessionId }, 12e4).then((res) => {
					if (res.ok === true) {
						setDetail(res);
						if (res.report !== void 0) reconcileRow(res.report);
					} else setError(res.error ?? "读取体检详情失败");
				}).catch((err) => setError(String(err instanceof Error ? err.message : err)));
			};
			const runRepair = (sessionId) => {
				setRepairing(true);
				setError(null);
				callHostAny$1("session-health-repair", { sessionId }, 12e4).then((res) => {
					if (res.ok === true) {
						setDischarge(res);
						if (res.after !== void 0) {
							setDetail({
								ok: true,
								report: res.after,
								prescriptions: res.prescriptions
							});
							reconcileRow(res.after);
						}
					} else setError(res.error ?? "处置失败");
				}).catch((err) => setError(String(err instanceof Error ? err.message : err))).finally(() => setRepairing(false));
			};
			const copy = (text) => {
				try {
					navigator.clipboard?.writeText(text);
					setCopied(text);
				} catch {}
			};
			const runSourceMigrate = (sessionId) => {
				setMigrating(true);
				setError(null);
				setMigrateNote(null);
				callHostAny$1("session-health-source-migrate", { sessionId }, 12e4).then((res) => {
					if (res.after !== void 0) {
						setDetail({
							ok: true,
							report: res.after,
							prescriptions: detail?.prescriptions ?? []
						});
						reconcileRow(res.after);
					}
					const changed = res.outcome?.changedRows ?? 0;
					if (res.ok === true && changed > 0) setMigrateNote(translate(t, "health.sourceMigrated", {
						n: changed,
						backup: res.outcome?.backup ?? ""
					}));
					else if (res.ok === true) setMigrateNote(translate(t, "health.sourceMigrateNone"));
					else setMigrateNote(translate(t, "health.sourceMigrateFail", { error: res.outcome?.error ?? res.error ?? "未知原因" }));
				}).catch((err) => setError(String(err instanceof Error ? err.message : err))).finally(() => setMigrating(false));
			};
			const report = detail?.report ?? discharge?.after;
			const lines = [];
			lines.push((0, react.createElement)("div", {
				key: "phase1",
				className: "dss_phaseRow"
			}, [(0, react.createElement)("span", {
				key: "l",
				className: "dss_phase"
			}, translate(t, "health.phase.checkup")), (0, react.createElement)("button", {
				key: "scan",
				type: "button",
				className: "dss_actBtn",
				disabled: scanning,
				onClick: runScan
			}, scanning ? translate(t, "health.scanning") : translate(t, "health.scan"))]));
			if (scanning && progress !== null) {
				const total = progress.total;
				const pct = total > 0 ? Math.min(100, Math.round(progress.done / total * 100)) : 0;
				lines.push((0, react.createElement)("div", {
					key: "progress",
					className: "dss_progressRow"
				}, [(0, react.createElement)("div", {
					key: "track",
					className: "dss_progressTrack"
				}, (0, react.createElement)("div", {
					key: "fill",
					className: total > 0 ? "dss_progressFill" : "dss_progressFill dss_progressIndeterminate",
					...total > 0 ? { style: { width: `${pct}%` } } : {}
				})), (0, react.createElement)("span", {
					key: "read",
					className: "dss_meta"
				}, translate(t, "health.progress", {
					done: progress.done,
					total: total > 0 ? total : "?",
					sec: (elapsedMs / 1e3).toFixed(1)
				}))]));
			}
			if (cacheInfo !== null && !scanning && detail === null && discharge === null) {
				const ago = relativeAgo(cacheInfo.generatedAt, Date.now());
				lines.push((0, react.createElement)("div", {
					key: "cache",
					className: "dss_cacheRow"
				}, [
					(0, react.createElement)("span", {
						key: "h",
						className: "dss_meta"
					}, translate(t, "health.cache.hint", { ago: translate(t, ago.key, { n: ago.n }) })),
					cacheInfo.currentTotal !== cacheInfo.total && (0, react.createElement)("span", {
						key: "chg",
						className: "dss_why"
					}, translate(t, "health.cache.corpusChanged", {
						was: cacheInfo.total,
						now: cacheInfo.currentTotal
					})),
					(0, react.createElement)("button", {
						key: "r",
						type: "button",
						className: "dss_actBtn",
						onClick: () => {
							runScan({ forceRefresh: true });
						}
					}, translate(t, "health.cache.refresh"))
				]));
			}
			if (error !== null) lines.push((0, react.createElement)("div", {
				key: "err",
				className: "dss_error"
			}, error));
			if (detail !== null || discharge !== null) lines.push((0, react.createElement)("div", {
				key: "back",
				className: "dss_btnRow"
			}, [(0, react.createElement)("button", {
				key: "b",
				type: "button",
				className: "dss_actBtn",
				onClick: () => {
					setDetail(null);
					setDischarge(null);
				}
			}, translate(t, "health.back"))]));
			if (report !== void 0) lines.push((0, react.createElement)("div", {
				key: "gates",
				className: "dss_gateList"
			}, report.gates.map((gate) => (0, react.createElement)("div", {
				key: gate.id,
				className: `dss_gate dss_gate_${gate.level}`
			}, [
				(0, react.createElement)("span", {
					key: "n",
					className: "dss_gateName"
				}, translate(t, GATE_LABEL[gate.id])),
				(0, react.createElement)("span", {
					key: "lv",
					className: `dss_levelPill dss_level_${gate.level}`
				}, translate(t, LEVEL_LABEL[gate.level])),
				(0, react.createElement)("span", {
					key: "ev",
					className: "dss_gateEvidence"
				}, gate.evidence),
				gate.attribution !== void 0 && (0, react.createElement)("span", {
					key: "at",
					className: "dss_meta"
				}, `${translate(t, "health.attribution")}: ${gate.attribution.package ?? "unknown"}${gate.attribution.projection !== void 0 ? ` · ${gate.attribution.projection}` : ""}${gate.attribution.field !== void 0 ? ` · ${translate(t, "health.field")} ${gate.attribution.field}` : ""}`)
			]))));
			else if (findings !== null) {
				if (findings.length === 0) lines.push((0, react.createElement)("div", {
					key: "clean",
					className: "dss_empty"
				}, translate(t, "health.empty")));
				else lines.push((0, react.createElement)("ul", {
					key: "list",
					className: "dss_list",
					role: "list"
				}, findings.map((item) => {
					const reasons = item.gates.filter((gate) => gate.level !== "ok").map((gate) => `${translate(t, GATE_LABEL[gate.id])}·${translate(t, LEVEL_LABEL[gate.level])}`).join(" · ");
					return (0, react.createElement)("li", {
						key: item.sessionId,
						className: "dss_row"
					}, [
						(0, react.createElement)("span", {
							key: "lv",
							className: `dss_levelPill dss_level_${item.level}`
						}, translate(t, LEVEL_LABEL[item.level])),
						item.priority === "high" && (0, react.createElement)("span", {
							key: "p",
							className: "dss_meta"
						}, translate(t, "health.priority.high")),
						(0, react.createElement)("span", {
							key: "id",
							className: "dss_meta dss_uuid"
						}, item.sessionId),
						reasons !== "" && (0, react.createElement)("span", {
							key: "why",
							className: "dss_why"
						}, reasons),
						(0, react.createElement)("button", {
							key: "d",
							type: "button",
							className: "dss_actBtn",
							onClick: () => {
								openDetail(item.sessionId);
							}
						}, translate(t, "health.detail"))
					]);
				})));
			}
			if (report !== void 0) {
				lines.push((0, react.createElement)("div", {
					key: "phase2",
					className: "dss_phaseRow"
				}, [(0, react.createElement)("span", {
					key: "l",
					className: "dss_phase"
				}, translate(t, "health.phase.prescribe")), (0, react.createElement)("button", {
					key: "repair",
					type: "button",
					className: "dss_actBtn",
					disabled: repairing || report.level === "ok",
					onClick: () => {
						runRepair(report.sessionId);
					}
				}, [repairing ? (0, react.createElement)("span", {
					key: "sp",
					className: "dss_spinner",
					"aria-hidden": "true"
				}) : null, (0, react.createElement)("span", { key: "tx" }, repairing ? translate(t, "health.repairing") : translate(t, "health.repair"))])]));
				if (report.gates.some((gate) => gate.id === "source-kind" && gate.level === "warn")) lines.push((0, react.createElement)("div", {
					key: "migrate",
					className: "dss_phaseRow"
				}, [(0, react.createElement)("button", {
					key: "m",
					type: "button",
					className: "dss_actBtn",
					disabled: migrating,
					onClick: () => {
						runSourceMigrate(report.sessionId);
					}
				}, [migrating ? (0, react.createElement)("span", {
					key: "sp",
					className: "dss_spinner",
					"aria-hidden": "true"
				}) : null, (0, react.createElement)("span", { key: "tx" }, migrating ? translate(t, "health.sourceMigrating") : translate(t, "health.sourceMigrate"))]), migrateNote !== null && (0, react.createElement)("span", {
					key: "note",
					className: "dss_status"
				}, migrateNote)]));
				const prescriptions = detail?.prescriptions ?? discharge?.prescriptions ?? [];
				if (prescriptions.length > 0) lines.push((0, react.createElement)("div", {
					key: "cmds",
					className: "dss_cmdBlock"
				}, [(0, react.createElement)("div", {
					key: "h",
					className: "dss_meta"
				}, translate(t, "health.commands")), ...prescriptions.map((line, index) => (0, react.createElement)("div", {
					key: `c${index}`,
					className: "dss_cmdLine"
				}, [(0, react.createElement)("code", {
					key: "code",
					className: "dss_cmd"
				}, line), (0, react.createElement)("button", {
					key: "cp",
					type: "button",
					className: "dss_actBtn",
					onClick: () => {
						copy(line);
					}
				}, copied === line ? translate(t, "health.copied") : translate(t, "health.copy"))]))]));
			}
			if (discharge !== null) {
				lines.push((0, react.createElement)("div", {
					key: "phase3",
					className: "dss_phaseRow"
				}, [
					(0, react.createElement)("span", {
						key: "l",
						className: "dss_phase"
					}, translate(t, "health.phase.discharge")),
					(0, react.createElement)("span", {
						key: "b",
						className: `dss_levelPill dss_level_${discharge.before?.level ?? "warn"}`
					}, `${translate(t, "health.before")}: ${translate(t, LEVEL_LABEL[discharge.before?.level ?? "warn"])}`),
					(0, react.createElement)("span", {
						key: "a",
						className: `dss_levelPill dss_level_${discharge.after?.level ?? "warn"}`
					}, `${translate(t, "health.after")}: ${translate(t, LEVEL_LABEL[discharge.after?.level ?? "warn"])}`)
				]));
				if (discharge.explanation !== void 0 && discharge.explanation !== "") lines.push((0, react.createElement)("div", {
					key: "verdict",
					className: `dss_verdict dss_verdict_${discharge.verdict ?? "failed"}`
				}, discharge.explanation));
				if (discharge.repair?.ok === true) lines.push((0, react.createElement)("div", {
					key: "repairNote",
					className: "dss_status"
				}, `${translate(t, "health.quarantined")} → ${discharge.repair.to ?? ""}`));
				else if (discharge.repair?.error !== void 0) lines.push((0, react.createElement)("div", {
					key: "repairErr",
					className: "dss_status"
				}, discharge.repair.error));
			}
			return (0, react.createElement)("div", { className: "dss_tabBody" }, lines);
		}
		//#endregion
		//#region src/client/search/host-api.ts
		/**
		* Client-side helpers and structural mirrors shared by the search panel and
		* the settings card. Everything talks to the host through the fenced
		* `/switch-search/api` route; no official package is value-imported.
		*/
		/** Fetch timeout for one host call (long for import: the body can be large). */
		const FETCH_TIMEOUT = 1e4;
		/** POST a JSON body to a fenced switch-search API method (items shape). */
		function callHost(method, body) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = controller !== void 0 && typeof setTimeout === "function" ? setTimeout(() => {
				controller.abort();
			}, FETCH_TIMEOUT) : void 0;
			return fetch(`/switch-search/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).then((data) => {
				const record = data;
				if (record && record.ok === true && Array.isArray(record.items)) return {
					ok: true,
					items: record.items
				};
				return {
					ok: false,
					items: [],
					error: record?.error ?? "请求失败"
				};
			}).catch((err) => ({
				ok: false,
				items: [],
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/** POST a body to a fenced switch-search API method, returning the whole record. */
		function callHostAny(method, body, timeout = FETCH_TIMEOUT) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/switch-search/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: typeof body === "string" ? body : JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/**
		* POST to the STEWARD fenced route (`/session-steward/api`) — the batch
		* management console (archive / unarchive / purge) rides the steward subdomain,
		* per the merged package's route contract (session-* methods stay there).
		*/
		function callSteward(method, body, timeout = FETCH_TIMEOUT) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/session-steward/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/** Trigger a browser download of the index snapshot from the host route. */
		async function downloadSnapshot() {
			const res = await fetch("/switch-search/api/index-export", { method: "POST" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `switch-search-snapshot-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.jsonl`;
			anchor.click();
			URL.revokeObjectURL(url);
		}
		/**
		* Open a session from a search hit through whichever face the running host
		* offers: `uiWorkspace.openSession` first (0.1.7+), the pre-0.1.7
		* `sessions.open` as fallback. Neither present → silent no-op: a host line
		* this package does not target must not crash the panel.
		*
		* The service names are resolved through `get` at call time, not captured at
		* apply time: this plugin applies before the session-controller / ui-workspace
		* client modules in the load order, so an eager lookup captures `undefined`
		* and every result click silently no-ops. Both are root-context singletons,
		* so by the time a user clicks a hit they are always mounted.
		*/
		function openSessionThrough(get, sessionId) {
			const uiWorkspace = get("uiWorkspace");
			if (uiWorkspace !== void 0 && typeof uiWorkspace.openSession === "function") {
				uiWorkspace.openSession(sessionId);
				return;
			}
			const sessions = get("sessions");
			if (sessions !== void 0 && typeof sessions.open === "function") sessions.open(sessionId);
		}
		//#endregion
		//#region src/client/search/locales.ts
		/** `switch-search` client dictionaries (zh / en / ja / ko / fr / de / it / ru / es), thinking-levels pattern. */
		/** Dictionary namespace owned by this plugin (the host settings namespace). */
		const NS$1 = "switch-search";
		/** All shipped dictionaries by locale id. */
		const dictionaries = {
			zh: {
				"card.title": "搜索索引",
				"card.description": "侧边栏会话搜索增强：标题搜索与内容搜索一键切换。内容搜索使用插件自建索引，不依赖 DSH 官方全文索引。",
				"card.unavailable": "设置命名空间不可用：请确认插件已装配进 profile。",
				"card.readonly": "只读",
				"card.enabled": "启用会话搜索",
				"card.enabled.desc": "在侧边栏底部显示\"搜索\"入口。",
				"card.defaultMode": "默认搜索模式",
				"card.defaultMode.desc": "面板打开时默认进入标题搜索还是内容搜索。",
				"card.mode.title": "标题",
				"card.mode.content": "内容",
				"card.autoSync": "自动同步索引",
				"card.autoSync.desc": "后台按水位增量同步会话日志到独立索引。",
				"card.syncInterval": "同步间隔（秒）",
				"card.syncInterval.desc": "两次增量同步之间的最小间隔。",
				"card.archiveKeep": "归档保留份数",
				"card.archiveKeep.desc": "每次整理索引后保留的历史索引文件数量。",
				"card.index": "内容搜索索引",
				"card.index.desc": "索引正常：已收录 {indexed} 个会话。",
				"card.index.archives": "，归档 {archives} 份。",
				"card.index.empty": "独立索引尚未建立。点击\"整理索引\"从会话日志全量建立。",
				"card.index.reading": "正在读取索引状态…",
				"card.index.rebuilding": "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）",
				"card.index.syncing": "正在同步索引…",
				"card.index.failures": "{count} 个会话同步失败（详见 Host 日志）。",
				"card.index.rebuildError": "整理失败：{error}",
				"card.index.rebuild": "整理索引",
				"card.index.rebuilding.btn": "整理中…",
				"card.index.rebuild.hint": "非破坏性：构建期间旧索引继续可搜索，完成后原子切换并归档旧索引。",
				"card.index.archivedOwner": "归档会话的浏览与清理由「会话管家」（dsh-session-steward）负责。本插件只读归档集合，把已归档会话排除出索引。",
				"card.index.archivedMissing": "归档会话的浏览与清理需要「会话管家」（dsh-session-steward），当前未安装。本插件只读归档集合，把已归档会话排除出索引。",
				"card.index.export": "导出快照",
				"card.index.import": "导入快照",
				"card.index.exported": "快照已导出为下载文件。",
				"card.index.import.started": "快照导入已开始：正在后台重建索引，完成后自动切换。",
				"card.index.importParse": "快照解析失败或无有效会话。",
				"card.action.failed": "操作失败：{error}",
				"panel.titleSearch": "标题",
				"panel.contentSearch": "内容",
				"panel.searchTitle": "搜索会话标题…",
				"panel.searchContent": "搜索会话内容…",
				"panel.entry": "搜索",
				"panel.buildIndex": "建立索引",
				"panel.archived": "已排除 {count} 个已归档会话",
				"panel.rebuilding": "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）",
				"panel.unavailable": "独立索引服务不可用：Host 未完成初始化。",
				"panel.notBuilt": "独立索引尚未建立：先建立索引即可启用内容搜索（不依赖 DSH 官方全文索引）。",
				"panel.loadingSessions": "正在读取会话列表…",
				"panel.sessionsError": "读取会话列表失败：{error}",
				"panel.noSessions": "暂无会话",
				"panel.noMatch": "没有匹配的会话。",
				"panel.loadingContent": "正在搜索会话内容…",
				"panel.contentError": "内容搜索失败：{error}",
				"panel.noContent": "没有匹配的内容。",
				"panel.contentHint": "输入内容关键词开始搜索。",
				"panel.noText": "(无文本)",
				"panel.untitled": "(未命名)",
				"panel.openSession": "打开会话",
				"panel.footer.invoke": "唤出",
				"panel.footer.close": "关闭",
				"filter.all": "全部",
				"filter.user": "用户",
				"filter.reply": "回复",
				"filter.tool": "工具",
				"sort.label": "结果排序",
				"sort.relevance": "相关度",
				"sort.time": "时间",
				"sort.relevance.hint": "按匹配强度排序（默认）。",
				"sort.time.hint": "按会话最后活动时间倒序，更新的排前面；同一时间再按匹配强度。",
				"type.user/message": "用户",
				"type.assistant/message": "回复",
				"type.tool/call": "工具调用",
				"type.tool/result": "工具结果",
				"panel.manage": "管理",
				"domain.all": "全部",
				"domain.active": "活跃",
				"domain.archived": "归档",
				"tag.archived": "归档",
				"manage.hint": "按工作区分组，勾选后批量操作；删除不可撤销。",
				"manage.restartHint": "优先走宿主内存 API 即时生效（0.1.7+ 归档/取消归档免重启）；不可用时直写存储文件，重启后侧栏生效。",
				"manage.done.restart": "需重启 DSH 后在侧栏完全生效。",
				"manage.group.nocwd": "（未分组）",
				"manage.selectGroup": "全选/取消本组",
				"manage.selected": "已选 {n}",
				"manage.batch.archive": "归档",
				"manage.batch.unarchive": "取消归档",
				"manage.batch.delete": "删除",
				"manage.batch.confirm": "确认删除",
				"manage.batch.working": "执行中…",
				"manage.done.archive": "已归档 {n} 个会话。",
				"manage.done.unarchive": "已取消归档 {n} 个会话。",
				"manage.done.purge": "已清理 {n} 个会话。",
				"manage.done.error": "操作失败：{error}",
				"panel.index.none": "索引未建立",
				"panel.index.count": "索引 {n}",
				"panel.index.rebuilding": "整理中 {done}/{total}",
				"panel.index.rebuild": "整理",
				"filter.favorites": "收藏",
				"date.from": "开始日期",
				"date.to": "结束日期",
				"star.on": "取消收藏",
				"star.off": "收藏"
			},
			en: {
				"card.title": "Search Index",
				"card.description": "Sidebar session search with title/content mode switching. Content search uses the plugin-owned index and never depends on the official DSH full-text index.",
				"card.unavailable": "Settings namespace unavailable: make sure the plugin is assembled into the profile.",
				"card.readonly": "Read-only",
				"card.enabled": "Enable session search",
				"card.enabled.desc": "Show the \"Search\" entry at the bottom of the sidebar.",
				"card.defaultMode": "Default search mode",
				"card.defaultMode.desc": "Which mode the panel opens in.",
				"card.mode.title": "Title",
				"card.mode.content": "Content",
				"card.autoSync": "Auto sync index",
				"card.autoSync.desc": "Incrementally sync session logs into the independent index in the background.",
				"card.syncInterval": "Sync interval (seconds)",
				"card.syncInterval.desc": "Minimum interval between two incremental syncs.",
				"card.archiveKeep": "Archives to keep",
				"card.archiveKeep.desc": "How many archived index files each rebuild retains.",
				"card.index": "Content search index",
				"card.index.desc": "Index ready: {indexed} sessions collected.",
				"card.index.archives": ", {archives} archive(s).",
				"card.index.empty": "Independent index not built yet. Click \"Rebuild index\" to build it from session logs.",
				"card.index.reading": "Reading index status…",
				"card.index.rebuilding": "Rebuilding index… {done}/{total} (the old index keeps serving during the rebuild)",
				"card.index.syncing": "Syncing index…",
				"card.index.failures": "{count} session(s) failed to sync (see Host logs).",
				"card.index.rebuildError": "Rebuild failed: {error}",
				"card.index.rebuild": "Rebuild index",
				"card.index.rebuilding.btn": "Rebuilding…",
				"card.index.rebuild.hint": "Non-destructive: the old index keeps serving while the shadow builds; the swap is atomic and the old index is archived.",
				"card.index.archivedOwner": "Browsing and disposing of archived sessions belongs to dsh-session-steward. This plugin only reads the archive set and excludes those sessions from the index.",
				"card.index.archivedMissing": "Browsing and disposing of archived sessions needs dsh-session-steward, which is not installed. This plugin only reads the archive set and excludes those sessions from the index.",
				"card.index.export": "Export snapshot",
				"card.index.import": "Import snapshot",
				"card.index.exported": "Snapshot downloaded.",
				"card.index.import.started": "Import started: the index rebuilds in the background and swaps in when done.",
				"card.index.importParse": "Snapshot parse failed or contains no valid session.",
				"card.action.failed": "Action failed: {error}",
				"panel.titleSearch": "Title",
				"panel.contentSearch": "Content",
				"panel.searchTitle": "Search session titles…",
				"panel.searchContent": "Search session content…",
				"panel.entry": "Search",
				"panel.buildIndex": "Build index",
				"panel.archived": "{count} archived session(s) excluded",
				"panel.rebuilding": "Rebuilding index… {done}/{total} (the old index keeps serving)",
				"panel.unavailable": "Independent index service unavailable: Host not initialized.",
				"panel.notBuilt": "Independent index not built yet: build it once to enable content search (no official FTS index needed).",
				"panel.loadingSessions": "Loading sessions…",
				"panel.sessionsError": "Failed to load sessions: {error}",
				"panel.noSessions": "No sessions",
				"panel.noMatch": "No matching sessions.",
				"panel.loadingContent": "Searching content…",
				"panel.contentError": "Content search failed: {error}",
				"panel.noContent": "No matching content.",
				"panel.contentHint": "Type keywords to search content.",
				"panel.noText": "(no text)",
				"panel.untitled": "(untitled)",
				"panel.openSession": "Open session",
				"panel.footer.invoke": "Open",
				"panel.footer.close": "Close",
				"filter.all": "All",
				"filter.user": "User",
				"filter.reply": "Reply",
				"filter.tool": "Tool",
				"sort.label": "Result ordering",
				"sort.relevance": "Relevance",
				"sort.time": "Time",
				"sort.relevance.hint": "Order by match strength (default).",
				"sort.time.hint": "Order by session last-activity, newest first; ties break on match strength.",
				"type.user/message": "User",
				"type.assistant/message": "Reply",
				"type.tool/call": "Tool call",
				"type.tool/result": "Tool result",
				"panel.manage": "Manage",
				"domain.all": "All",
				"domain.active": "Active",
				"domain.archived": "Archived",
				"tag.archived": "Archived",
				"manage.hint": "Grouped by workspace; tick rows then batch-operate. Deletion is irreversible.",
				"manage.restartHint": "Prefers host in-memory APIs (0.1.7+ archive/unarchive apply instantly); falls back to direct storage-file edits, which need a restart.",
				"manage.done.restart": "Restart DSH for the sidebar to fully reflect this.",
				"manage.group.nocwd": "(no workspace)",
				"manage.selectGroup": "Toggle the whole group",
				"manage.selected": "{n} selected",
				"manage.batch.archive": "Archive",
				"manage.batch.unarchive": "Unarchive",
				"manage.batch.delete": "Delete",
				"manage.batch.confirm": "Confirm delete",
				"manage.batch.working": "Working…",
				"manage.done.archive": "Archived {n} sessions.",
				"manage.done.unarchive": "Unarchived {n} sessions.",
				"manage.done.purge": "Purged {n} sessions.",
				"manage.done.error": "Operation failed: {error}",
				"panel.index.none": "Index not built",
				"panel.index.count": "Index {n}",
				"panel.index.rebuilding": "Rebuilding {done}/{total}",
				"panel.index.rebuild": "Rebuild",
				"filter.favorites": "Favorites",
				"date.from": "From date",
				"date.to": "To date",
				"star.on": "Unfavorite",
				"star.off": "Favorite"
			},
			ja: {
				"card.title": "検索インデックス",
				"card.description": "サイドバーセッション検索の強化：タイトル検索とコンテンツ検索のワンクリック切り替え。コンテンツ検索はプラグイン独自のインデックスを使用し、DSH公式全文インデックスに依存しません。",
				"card.unavailable": "設定名前空間が利用できません：プラグインがプロファイルに組み込まれていることを確認してください。",
				"card.readonly": "読み取り専用",
				"card.enabled": "セッション検索を有効化",
				"card.enabled.desc": "サイドバー下部に「検索」エントリを表示します。",
				"card.defaultMode": "デフォルト検索モード",
				"card.defaultMode.desc": "パネルを開いたときの初期モード。",
				"card.mode.title": "タイトル",
				"card.mode.content": "コンテンツ",
				"card.autoSync": "インデックス自動同期",
				"card.autoSync.desc": "バックグラウンドでセッションログを独立インデックスに増分同期します。",
				"card.syncInterval": "同期間隔（秒）",
				"card.syncInterval.desc": "2回の増分同期間の最小間隔。",
				"card.archiveKeep": "アーカイブ保持数",
				"card.archiveKeep.desc": "インデックス再構築ごとに保持するアーカイブファイル数。",
				"card.index": "コンテンツ検索インデックス",
				"card.index.desc": "インデックス正常：{indexed} セッションを収容済み。",
				"card.index.archives": "、アーカイブ {archives} 件。",
				"card.index.empty": "独立インデックスが未構築です。「インデックス再構築」をクリックしてセッションログから構築してください。",
				"card.index.reading": "インデックス状態を読み取り中…",
				"card.index.rebuilding": "インデックス再構築中… {done}/{total}（再構築中も旧インデックスで検索可能）",
				"card.index.syncing": "インデックス同期中…",
				"card.index.failures": "{count} 件のセッション同期に失敗（Hostログ参照）。",
				"card.index.rebuildError": "再構築失敗：{error}",
				"card.index.rebuild": "インデックス再構築",
				"card.index.rebuilding.btn": "再構築中…",
				"card.index.rebuild.hint": "非破壊的：構築中も旧インデックスで検索可能、完了後にアトミック切替し旧インデックスをアーカイブ。",
				"card.index.archivedOwner": "アーカイブ済みセッションの閲覧と清理は「セッション管理者」（dsh-session-steward）が担当。本プラグインはアーカイブ集合を読み取り専用で参照し、アーカイブ済みセッションをインデックスから除外します。",
				"card.index.archivedMissing": "アーカイブ済みセッションの閲覧と清理には「セッション管理者」（dsh-session-steward）が必要ですが、現在未インストールです。本プラグインはアーカイブ集合を読み取り専用で参照し、アーカイブ済みセッションをインデックスから除外します。",
				"card.index.export": "スナップショット書出",
				"card.index.import": "スナップショット読込",
				"card.index.exported": "スナップショットをダウンロードしました。",
				"card.index.import.started": "スナップショットのインポートを開始：バックグラウンドでインデックスを再構築し、完了後に自動切替。",
				"card.index.importParse": "スナップショットの解析に失敗、または有効なセッションがありません。",
				"card.action.failed": "操作失敗：{error}",
				"panel.titleSearch": "タイトル",
				"panel.contentSearch": "コンテンツ",
				"panel.searchTitle": "セッションタイトルを検索…",
				"panel.searchContent": "セッション内容を検索…",
				"panel.entry": "検索",
				"panel.buildIndex": "インデックス構築",
				"panel.archived": "アーカイブ済み {count} 件を除外",
				"panel.rebuilding": "インデックス再構築中… {done}/{total}（再構築中も旧インデックスで検索可能）",
				"panel.unavailable": "独立インデックスサービス利用不可：Host初期化未完了。",
				"panel.notBuilt": "独立インデックス未構築：構築すればコンテンツ検索が有効になります（DSH公式全文インデックス不要）。",
				"panel.loadingSessions": "セッション一覧を読み込み中…",
				"panel.sessionsError": "セッション一覧の読み込み失敗：{error}",
				"panel.noSessions": "セッションなし",
				"panel.noMatch": "一致するセッションがありません。",
				"panel.loadingContent": "セッション内容を検索中…",
				"panel.contentError": "コンテンツ検索失敗：{error}",
				"panel.noContent": "一致するコンテンツがありません。",
				"panel.contentHint": "キーワードを入力してコンテンツを検索。",
				"panel.noText": "（テキストなし）",
				"panel.untitled": "（無題）",
				"panel.openSession": "セッションを開く",
				"panel.footer.invoke": "開く",
				"panel.footer.close": "閉じる",
				"filter.all": "すべて",
				"filter.user": "ユーザー",
				"filter.reply": "返信",
				"filter.tool": "ツール",
				"sort.label": "結果の並べ替え",
				"sort.relevance": "関連度",
				"sort.time": "時間",
				"sort.relevance.hint": "一致強度順に並べ替え（デフォルト）。",
				"sort.time.hint": "セッション最終活動日時の降順、同着時は一致強度順。",
				"type.user/message": "ユーザー",
				"type.assistant/message": "返信",
				"type.tool/call": "ツール呼び出し",
				"type.tool/result": "ツール結果"
			},
			ko: {
				"card.title": "검색 인덱스",
				"card.description": "사이드바 세션 검색 강화: 제목 검색과 콘텐츠 검색 간 원클릭 전환. 콘텐츠 검색은 플러그인 자체 인덱스를 사용하며 DSH 공식 전문 인덱스에 의존하지 않습니다.",
				"card.unavailable": "설정 네임스페이스를 사용할 수 없습니다: 플러그인이 프로파일에 조립되어 있는지 확인하세요.",
				"card.readonly": "읽기 전용",
				"card.enabled": "세션 검색 활성화",
				"card.enabled.desc": "사이드바 하단에 \"검색\" 항목을 표시합니다.",
				"card.defaultMode": "기본 검색 모드",
				"card.defaultMode.desc": "패널을 열 때 기본 모드.",
				"card.mode.title": "제목",
				"card.mode.content": "콘텐츠",
				"card.autoSync": "인덱스 자동 동기화",
				"card.autoSync.desc": "백그라운드에서 세션 로그를 독립 인덱스에 증분 동기화합니다.",
				"card.syncInterval": "동기화 간격(초)",
				"card.syncInterval.desc": "두 증분 동기화 사이의 최소 간격.",
				"card.archiveKeep": "아카이브 보존 수",
				"card.archiveKeep.desc": "인덱스 재구축 시 보존할 아카이브 파일 수.",
				"card.index": "콘텐츠 검색 인덱스",
				"card.index.desc": "인덱스 정상: {indexed}개 세션 수집 완료.",
				"card.index.archives": ", 아카이브 {archives}건.",
				"card.index.empty": "독립 인덱스가 아직 구축되지 않았습니다. \"인덱스 재구축\"을 클릭하여 세션 로그에서 구축하세요.",
				"card.index.reading": "인덱스 상태 읽는 중…",
				"card.index.rebuilding": "인덱스 재구축 중… {done}/{total} (재구축 중에도 이전 인덱스로 검색 가능)",
				"card.index.syncing": "인덱스 동기화 중…",
				"card.index.failures": "{count}개 세션 동기화 실패 (Host 로그 참조).",
				"card.index.rebuildError": "재구축 실패: {error}",
				"card.index.rebuild": "인덱스 재구축",
				"card.index.rebuilding.btn": "재구축 중…",
				"card.index.rebuild.hint": "비파괴적: 구축 중에도 이전 인덱스로 검색 가능하며, 완료 후 원자적 전환하고 이전 인덱스를 아카이브합니다.",
				"card.index.archivedOwner": "아카이브된 세션의 탐색 및 정리는 \"세션 관리자\"(dsh-session-steward)가 담당합니다. 본 플러그인은 아카이브 세트를 읽기 전용으로 참조하여 아카이브된 세션을 인덱스에서 제외합니다.",
				"card.index.archivedMissing": "아카이브된 세션의 탐색 및 정리에는 \"세션 관리자\"(dsh-session-steward)가 필요하지만 현재 미설치 상태입니다. 본 플러그인은 아카이브 세트를 읽기 전용으로 참조하여 아카이브된 세션을 인덱스에서 제외합니다.",
				"card.index.export": "스냅샷 내보내기",
				"card.index.import": "스냅샷 가져오기",
				"card.index.exported": "스냅샷이 다운로드되었습니다.",
				"card.index.import.started": "스냅샷 가져오기 시작: 백그라운드에서 인덱스를 재구축하며 완료 후 자동 전환됩니다.",
				"card.index.importParse": "스냅샷 파싱 실패 또는 유효한 세션 없음.",
				"card.action.failed": "작업 실패: {error}",
				"panel.titleSearch": "제목",
				"panel.contentSearch": "콘텐츠",
				"panel.searchTitle": "세션 제목 검색…",
				"panel.searchContent": "세션 콘텐츠 검색…",
				"panel.entry": "검색",
				"panel.buildIndex": "인덱스 구축",
				"panel.archived": "아카이브된 {count}개 세션 제외됨",
				"panel.rebuilding": "인덱스 재구축 중… {done}/{total} (재구축 중에도 이전 인덱스로 검색 가능)",
				"panel.unavailable": "독립 인덱스 서비스 사용 불가: Host 초기화 미완료.",
				"panel.notBuilt": "독립 인덱스 미구축: 구축하면 콘텐츠 검색이 활성화됩니다 (DSH 공식 전문 인덱스 불필요).",
				"panel.loadingSessions": "세션 목록 읽는 중…",
				"panel.sessionsError": "세션 목록 읽기 실패: {error}",
				"panel.noSessions": "세션 없음",
				"panel.noMatch": "일치하는 세션이 없습니다.",
				"panel.loadingContent": "세션 콘텐츠 검색 중…",
				"panel.contentError": "콘텐츠 검색 실패: {error}",
				"panel.noContent": "일치하는 콘텐츠가 없습니다.",
				"panel.contentHint": "키워드를 입력하여 콘텐츠를 검색하세요.",
				"panel.noText": "(텍스트 없음)",
				"panel.untitled": "(제목 없음)",
				"panel.openSession": "세션 열기",
				"panel.footer.invoke": "열기",
				"panel.footer.close": "닫기",
				"filter.all": "전체",
				"filter.user": "사용자",
				"filter.reply": "답변",
				"filter.tool": "도구",
				"sort.label": "결과 정렬",
				"sort.relevance": "관련도",
				"sort.time": "시간",
				"sort.relevance.hint": "일치 강도순 정렬(기본값).",
				"sort.time.hint": "세션 마지막 활동 시간 내림차순, 동률 시 일치 강도순.",
				"type.user/message": "사용자",
				"type.assistant/message": "답변",
				"type.tool/call": "도구 호출",
				"type.tool/result": "도구 결과"
			},
			fr: {
				"card.title": "Index de recherche",
				"card.description": "Recherche de sessions dans la barre latérale avec bascule titre/contenu. La recherche de contenu utilise l'index indépendant du plugin et ne dépend jamais de l'index full-text officiel DSH.",
				"card.unavailable": "Espace de noms des paramètres indisponible : vérifiez que le plugin est assemblé dans le profil.",
				"card.readonly": "Lecture seule",
				"card.enabled": "Activer la recherche de sessions",
				"card.enabled.desc": "Afficher l'entrée « Recherche » en bas de la barre latérale.",
				"card.defaultMode": "Mode de recherche par défaut",
				"card.defaultMode.desc": "Mode d'ouverture du panneau.",
				"card.mode.title": "Titre",
				"card.mode.content": "Contenu",
				"card.autoSync": "Synchronisation automatique de l'index",
				"card.autoSync.desc": "Synchronisation incrémentale des journaux de session vers l'index indépendant en arrière-plan.",
				"card.syncInterval": "Intervalle de synchronisation (secondes)",
				"card.syncInterval.desc": "Intervalle minimum entre deux synchronisations incrémentales.",
				"card.archiveKeep": "Archives à conserver",
				"card.archiveKeep.desc": "Nombre de fichiers d'index archivés conservés à chaque reconstruction.",
				"card.index": "Index de recherche de contenu",
				"card.index.desc": "Index prêt : {indexed} sessions collectées.",
				"card.index.archives": ", {archives} archive(s).",
				"card.index.empty": "Index indépendant pas encore construit. Cliquez sur « Reconstruire l'index » pour le créer à partir des journaux de session.",
				"card.index.reading": "Lecture de l'état de l'index…",
				"card.index.rebuilding": "Reconstruction de l'index… {done}/{total} (l'ancien index reste actif pendant la reconstruction)",
				"card.index.syncing": "Synchronisation de l'index…",
				"card.index.failures": "{count} session(s) en échec de synchronisation (voir les journaux Host).",
				"card.index.rebuildError": "Échec de la reconstruction : {error}",
				"card.index.rebuild": "Reconstruire l'index",
				"card.index.rebuilding.btn": "Reconstruction…",
				"card.index.rebuild.hint": "Non destructif : l'ancien index reste actif pendant la construction ; l'échange est atomique et l'ancien index est archivé.",
				"card.index.archivedOwner": "La consultation et la suppression des sessions archivées relèvent de dsh-session-steward. Ce plugin lit uniquement l'ensemble archivé et exclut ces sessions de l'index.",
				"card.index.archivedMissing": "La consultation et la suppression des sessions archivées nécessitent dsh-session-steward, qui n'est pas installé. Ce plugin lit uniquement l'ensemble archivé et exclut ces sessions de l'index.",
				"card.index.export": "Exporter l'instantané",
				"card.index.import": "Importer l'instantané",
				"card.index.exported": "Instantané téléchargé.",
				"card.index.import.started": "Import démarré : l'index se reconstruit en arrière-plan et bascule une fois terminé.",
				"card.index.importParse": "Échec de l'analyse de l'instantané ou aucune session valide.",
				"card.action.failed": "Échec de l'opération : {error}",
				"panel.titleSearch": "Titre",
				"panel.contentSearch": "Contenu",
				"panel.searchTitle": "Rechercher dans les titres…",
				"panel.searchContent": "Rechercher dans le contenu…",
				"panel.entry": "Recherche",
				"panel.buildIndex": "Construire l'index",
				"panel.archived": "{count} session(s) archivée(s) exclue(s)",
				"panel.rebuilding": "Reconstruction de l'index… {done}/{total} (l'ancien index reste actif)",
				"panel.unavailable": "Service d'index indépendant indisponible : Host non initialisé.",
				"panel.notBuilt": "Index indépendant pas encore construit : construisez-le pour activer la recherche de contenu (aucun index FTS officiel requis).",
				"panel.loadingSessions": "Chargement des sessions…",
				"panel.sessionsError": "Échec du chargement des sessions : {error}",
				"panel.noSessions": "Aucune session",
				"panel.noMatch": "Aucune session correspondante.",
				"panel.loadingContent": "Recherche dans le contenu…",
				"panel.contentError": "Échec de la recherche de contenu : {error}",
				"panel.noContent": "Aucun contenu correspondant.",
				"panel.contentHint": "Saisissez des mots-clés pour rechercher dans le contenu.",
				"panel.noText": "(pas de texte)",
				"panel.untitled": "(sans titre)",
				"panel.openSession": "Ouvrir la session",
				"panel.footer.invoke": "Ouvrir",
				"panel.footer.close": "Fermer",
				"filter.all": "Tout",
				"filter.user": "Utilisateur",
				"filter.reply": "Réponse",
				"filter.tool": "Outil",
				"sort.label": "Ordre des résultats",
				"sort.relevance": "Pertinence",
				"sort.time": "Temps",
				"sort.relevance.hint": "Trier par force de correspondance (par défaut).",
				"sort.time.hint": "Trier par dernière activité, plus récent d'abord ; à égalité, par force de correspondance.",
				"type.user/message": "Utilisateur",
				"type.assistant/message": "Réponse",
				"type.tool/call": "Appel d'outil",
				"type.tool/result": "Résultat d'outil"
			},
			de: {
				"card.title": "Suchindex",
				"card.description": "Sidebar-Sitzungssuche mit Titel-/Inhaltsmodus-Umschaltung. Die Inhaltssuche verwendet den plugin-eigenen Index und hängt nie vom offiziellen DSH-Volltextindex ab.",
				"card.unavailable": "Einstellungs-Namensraum nicht verfügbar: Stellen Sie sicher, dass das Plugin im Profil zusammengestellt ist.",
				"card.readonly": "Schreibgeschützt",
				"card.enabled": "Sitzungssuche aktivieren",
				"card.enabled.desc": "Den „Suche\"-Eintrag am unteren Rand der Sidebar anzeigen.",
				"card.defaultMode": "Standardsuchmodus",
				"card.defaultMode.desc": "In welchem Modus das Panel geöffnet wird.",
				"card.mode.title": "Titel",
				"card.mode.content": "Inhalt",
				"card.autoSync": "Index automatisch synchronisieren",
				"card.autoSync.desc": "Sitzungsprotokolle inkrementell in den unabhängigen Index im Hintergrund synchronisieren.",
				"card.syncInterval": "Synchronisierungsintervall (Sekunden)",
				"card.syncInterval.desc": "Mindestintervall zwischen zwei inkrementellen Synchronisierungen.",
				"card.archiveKeep": "Aufzubewahrende Archive",
				"card.archiveKeep.desc": "Anzahl der archivierten Indexdateien, die jeder Neuaufbau beibehält.",
				"card.index": "Inhaltssuchindex",
				"card.index.desc": "Index bereit: {indexed} Sitzungen erfasst.",
				"card.index.archives": ", {archives} Archiv(e).",
				"card.index.empty": "Unabhängiger Index noch nicht aufgebaut. Klicken Sie auf „Index neu aufbauen\", um ihn aus Sitzungsprotokollen zu erstellen.",
				"card.index.reading": "Indexstatus wird gelesen…",
				"card.index.rebuilding": "Index wird neu aufgebaut… {done}/{total} (der alte Index bleibt während des Neuaufbaus aktiv)",
				"card.index.syncing": "Index wird synchronisiert…",
				"card.index.failures": "{count} Sitzung(en) konnten nicht synchronisiert werden (siehe Host-Protokolle).",
				"card.index.rebuildError": "Neuaufbau fehlgeschlagen: {error}",
				"card.index.rebuild": "Index neu aufbauen",
				"card.index.rebuilding.btn": "Wird aufgebaut…",
				"card.index.rebuild.hint": "Zerstörungsfrei: Der alte Index bleibt aktiv, während der Schatten-Index aufgebaut wird; der Tausch erfolgt atomar und der alte Index wird archiviert.",
				"card.index.archivedOwner": "Das Durchsuchen und Entsorgen archivierter Sitzungen gehört zu dsh-session-steward. Dieses Plugin liest nur das Archiv-Set und schließt diese Sitzungen aus dem Index aus.",
				"card.index.archivedMissing": "Das Durchsuchen und Entsorgen archivierter Sitzungen erfordert dsh-session-steward, das nicht installiert ist. Dieses Plugin liest nur das Archiv-Set und schließt diese Sitzungen aus dem Index aus.",
				"card.index.export": "Snapshot exportieren",
				"card.index.import": "Snapshot importieren",
				"card.index.exported": "Snapshot heruntergeladen.",
				"card.index.import.started": "Import gestartet: Der Index wird im Hintergrund neu aufgebaut und nach Fertigstellung atomar ausgetauscht.",
				"card.index.importParse": "Snapshot-Analyse fehlgeschlagen oder enthält keine gültige Sitzung.",
				"card.action.failed": "Aktion fehlgeschlagen: {error}",
				"panel.titleSearch": "Titel",
				"panel.contentSearch": "Inhalt",
				"panel.searchTitle": "Sitzungstitel durchsuchen…",
				"panel.searchContent": "Sitzungsinhalt durchsuchen…",
				"panel.entry": "Suche",
				"panel.buildIndex": "Index aufbauen",
				"panel.archived": "{count} archivierte Sitzung(en) ausgeschlossen",
				"panel.rebuilding": "Index wird neu aufgebaut… {done}/{total} (der alte Index bleibt aktiv)",
				"panel.unavailable": "Unabhängiger Indexdienst nicht verfügbar: Host nicht initialisiert.",
				"panel.notBuilt": "Unabhängiger Index noch nicht aufgebaut: Bauen Sie ihn auf, um die Inhaltssuche zu aktivieren (kein offizieller FTS-Index erforderlich).",
				"panel.loadingSessions": "Sitzungen werden geladen…",
				"panel.sessionsError": "Sitzungen konnten nicht geladen werden: {error}",
				"panel.noSessions": "Keine Sitzungen",
				"panel.noMatch": "Keine passenden Sitzungen.",
				"panel.loadingContent": "Inhalt wird durchsucht…",
				"panel.contentError": "Inhaltssuche fehlgeschlagen: {error}",
				"panel.noContent": "Kein passender Inhalt.",
				"panel.contentHint": "Geben Sie Stichwörter ein, um Inhalte zu durchsuchen.",
				"panel.noText": "(kein Text)",
				"panel.untitled": "(unbenannt)",
				"panel.openSession": "Sitzung öffnen",
				"panel.footer.invoke": "Öffnen",
				"panel.footer.close": "Schließen",
				"filter.all": "Alle",
				"filter.user": "Benutzer",
				"filter.reply": "Antwort",
				"filter.tool": "Werkzeug",
				"sort.label": "Ergebnissortierung",
				"sort.relevance": "Relevanz",
				"sort.time": "Zeit",
				"sort.relevance.hint": "Nach Übereinstimmungsstärke sortieren (Standard).",
				"sort.time.hint": "Nach letzter Sitzungsaktivität, neueste zuerst; bei Gleichstand nach Übereinstimmungsstärke.",
				"type.user/message": "Benutzer",
				"type.assistant/message": "Antwort",
				"type.tool/call": "Werkzeugaufruf",
				"type.tool/result": "Werkzeugergebnis"
			},
			it: {
				"card.title": "Indice di ricerca",
				"card.description": "Ricerca sessioni nella barra laterale con commutazione titolo/contenuto. La ricerca per contenuto utilizza l'indice indipendente del plugin e non dipende mai dall'indice full-text ufficiale DSH.",
				"card.unavailable": "Namespace delle impostazioni non disponibile: verificare che il plugin sia assemblato nel profilo.",
				"card.readonly": "Sola lettura",
				"card.enabled": "Abilita ricerca sessioni",
				"card.enabled.desc": "Mostra la voce «Ricerca» in fondo alla barra laterale.",
				"card.defaultMode": "Modalità di ricerca predefinita",
				"card.defaultMode.desc": "Modalità di apertura del pannello.",
				"card.mode.title": "Titolo",
				"card.mode.content": "Contenuto",
				"card.autoSync": "Sincronizzazione automatica indice",
				"card.autoSync.desc": "Sincronizza incrementalmente i log delle sessioni nell'indice indipendente in background.",
				"card.syncInterval": "Intervallo sincronizzazione (secondi)",
				"card.syncInterval.desc": "Intervallo minimo tra due sincronizzazioni incrementali.",
				"card.archiveKeep": "Archivi da conservare",
				"card.archiveKeep.desc": "Numero di file indice archiviati conservati ad ogni ricostruzione.",
				"card.index": "Indice ricerca contenuti",
				"card.index.desc": "Indice pronto: {indexed} sessioni raccolte.",
				"card.index.archives": ", {archives} archivio/i.",
				"card.index.empty": "Indice indipendente non ancora costruito. Fare clic su «Ricostruisci indice» per crearlo dai log delle sessioni.",
				"card.index.reading": "Lettura stato indice…",
				"card.index.rebuilding": "Ricostruzione indice… {done}/{total} (il vecchio indice resta attivo durante la ricostruzione)",
				"card.index.syncing": "Sincronizzazione indice…",
				"card.index.failures": "{count} sessione/i non sincronizzata/e (vedi log Host).",
				"card.index.rebuildError": "Ricostruzione fallita: {error}",
				"card.index.rebuild": "Ricostruisci indice",
				"card.index.rebuilding.btn": "Ricostruzione…",
				"card.index.rebuild.hint": "Non distruttivo: il vecchio indice resta attivo durante la costruzione; lo scambio è atomico e il vecchio indice viene archiviato.",
				"card.index.archivedOwner": "La consultazione e l'eliminazione delle sessioni archiviate spettano a dsh-session-steward. Questo plugin legge solo l'insieme archiviato ed esclude tali sessioni dall'indice.",
				"card.index.archivedMissing": "La consultazione e l'eliminazione delle sessioni archiviate richiedono dsh-session-steward, attualmente non installato. Questo plugin legge solo l'insieme archiviato ed esclude tali sessioni dall'indice.",
				"card.index.export": "Esporta snapshot",
				"card.index.import": "Importa snapshot",
				"card.index.exported": "Snapshot scaricato.",
				"card.index.import.started": "Importazione avviata: l'indice viene ricostruito in background e scambiato al termine.",
				"card.index.importParse": "Analisi snapshot fallita o nessuna sessione valida.",
				"card.action.failed": "Operazione fallita: {error}",
				"panel.titleSearch": "Titolo",
				"panel.contentSearch": "Contenuto",
				"panel.searchTitle": "Cerca nei titoli delle sessioni…",
				"panel.searchContent": "Cerca nel contenuto delle sessioni…",
				"panel.entry": "Ricerca",
				"panel.buildIndex": "Costruisci indice",
				"panel.archived": "{count} sessione/i archiviata/e esclusa/e",
				"panel.rebuilding": "Ricostruzione indice… {done}/{total} (il vecchio indice resta attivo)",
				"panel.unavailable": "Servizio indice indipendente non disponibile: Host non inizializzato.",
				"panel.notBuilt": "Indice indipendente non ancora costruito: costruiscilo per abilitare la ricerca per contenuto (nessun indice FTS ufficiale richiesto).",
				"panel.loadingSessions": "Caricamento sessioni…",
				"panel.sessionsError": "Caricamento sessioni fallito: {error}",
				"panel.noSessions": "Nessuna sessione",
				"panel.noMatch": "Nessuna sessione corrispondente.",
				"panel.loadingContent": "Ricerca nel contenuto…",
				"panel.contentError": "Ricerca contenuto fallita: {error}",
				"panel.noContent": "Nessun contenuto corrispondente.",
				"panel.contentHint": "Inserisci parole chiave per cercare nel contenuto.",
				"panel.noText": "(nessun testo)",
				"panel.untitled": "(senza titolo)",
				"panel.openSession": "Apri sessione",
				"panel.footer.invoke": "Apri",
				"panel.footer.close": "Chiudi",
				"filter.all": "Tutti",
				"filter.user": "Utente",
				"filter.reply": "Risposta",
				"filter.tool": "Strumento",
				"sort.label": "Ordinamento risultati",
				"sort.relevance": "Pertinenza",
				"sort.time": "Tempo",
				"sort.relevance.hint": "Ordina per forza di corrispondenza (predefinito).",
				"sort.time.hint": "Ordina per ultima attività, più recente prima; a parità, per forza di corrispondenza.",
				"type.user/message": "Utente",
				"type.assistant/message": "Risposta",
				"type.tool/call": "Chiamata strumento",
				"type.tool/result": "Risultato strumento"
			},
			ru: {
				"card.title": "Поисковый индекс",
				"card.description": "Поиск сессий в боковой панели с переключением «заголовки/содержимое». Поиск по содержимому использует собственный индекс плагина и не зависит от официального полнотекстового индекса DSH.",
				"card.unavailable": "Пространство имён настроек недоступно: убедитесь, что плагин собран в профиле.",
				"card.readonly": "Только чтение",
				"card.enabled": "Включить поиск сессий",
				"card.enabled.desc": "Показывать пункт «Поиск» в нижней части боковой панели.",
				"card.defaultMode": "Режим поиска по умолчанию",
				"card.defaultMode.desc": "Режим открытия панели.",
				"card.mode.title": "Заголовок",
				"card.mode.content": "Содержимое",
				"card.autoSync": "Автосинхронизация индекса",
				"card.autoSync.desc": "Инкрементальная синхронизация журналов сессий в независимый индекс в фоновом режиме.",
				"card.syncInterval": "Интервал синхронизации (сек)",
				"card.syncInterval.desc": "Минимальный интервал между двумя инкрементальными синхронизациями.",
				"card.archiveKeep": "Хранимых архивов",
				"card.archiveKeep.desc": "Сколько архивных файлов индекса сохранять при каждой пересборке.",
				"card.index": "Индекс поиска по содержимому",
				"card.index.desc": "Индекс готов: собрано {indexed} сессий.",
				"card.index.archives": ", архивов: {archives}.",
				"card.index.empty": "Независимый индекс ещё не построен. Нажмите «Пересобрать индекс», чтобы создать его из журналов сессий.",
				"card.index.reading": "Чтение состояния индекса…",
				"card.index.rebuilding": "Пересборка индекса… {done}/{total} (старый индекс остаётся доступным во время пересборки)",
				"card.index.syncing": "Синхронизация индекса…",
				"card.index.failures": "{count} сессий не синхронизировано (см. журналы Host).",
				"card.index.rebuildError": "Пересборка не удалась: {error}",
				"card.index.rebuild": "Пересобрать индекс",
				"card.index.rebuilding.btn": "Пересборка…",
				"card.index.rebuild.hint": "Недеструктивно: старый индекс остаётся доступным, пока строится теневой; замена атомарна, старый индекс архивируется.",
				"card.index.archivedOwner": "Просмотр и удаление архивных сессий — задача dsh-session-steward. Этот плагин только читает набор архива и исключает архивные сессии из индекса.",
				"card.index.archivedMissing": "Для просмотра и удаления архивных сессий требуется dsh-session-steward, который не установлен. Этот плагин только читает набор архива и исключает архивные сессии из индекса.",
				"card.index.export": "Экспорт снимка",
				"card.index.import": "Импорт снимка",
				"card.index.exported": "Снимок скачан.",
				"card.index.import.started": "Импорт начат: индекс пересобирается в фоне и переключается по завершении.",
				"card.index.importParse": "Ошибка разбора снимка или нет допустимых сессий.",
				"card.action.failed": "Действие не выполнено: {error}",
				"panel.titleSearch": "Заголовок",
				"panel.contentSearch": "Содержимое",
				"panel.searchTitle": "Поиск по заголовкам сессий…",
				"panel.searchContent": "Поиск по содержимому сессий…",
				"panel.entry": "Поиск",
				"panel.buildIndex": "Построить индекс",
				"panel.archived": "Исключено {count} архивных сессий",
				"panel.rebuilding": "Пересборка индекса… {done}/{total} (старый индекс остаётся доступным)",
				"panel.unavailable": "Сервис независимого индекса недоступен: Host не инициализирован.",
				"panel.notBuilt": "Независимый индекс не построен: постройте его, чтобы включить поиск по содержимому (официальный FTS-индекс не требуется).",
				"panel.loadingSessions": "Загрузка сессий…",
				"panel.sessionsError": "Не удалось загрузить сессии: {error}",
				"panel.noSessions": "Нет сессий",
				"panel.noMatch": "Нет подходящих сессий.",
				"panel.loadingContent": "Поиск по содержимому…",
				"panel.contentError": "Поиск по содержимому не удался: {error}",
				"panel.noContent": "Нет подходящего содержимого.",
				"panel.contentHint": "Введите ключевые слова для поиска по содержимому.",
				"panel.noText": "(без текста)",
				"panel.untitled": "(без названия)",
				"panel.openSession": "Открыть сессию",
				"panel.footer.invoke": "Открыть",
				"panel.footer.close": "Закрыть",
				"filter.all": "Все",
				"filter.user": "Пользователь",
				"filter.reply": "Ответ",
				"filter.tool": "Инструмент",
				"sort.label": "Сортировка результатов",
				"sort.relevance": "Релевантность",
				"sort.time": "Время",
				"sort.relevance.hint": "Сортировать по силе совпадения (по умолчанию).",
				"sort.time.hint": "Сортировать по последней активности, сначала новые; при равенстве — по силе совпадения.",
				"type.user/message": "Пользователь",
				"type.assistant/message": "Ответ",
				"type.tool/call": "Вызов инструмента",
				"type.tool/result": "Результат инструмента"
			},
			es: {
				"card.title": "Índice de búsqueda",
				"card.description": "Búsqueda de sesiones en la barra lateral con cambio entre título y contenido. La búsqueda de contenido usa el índice propio del plugin y nunca depende del índice de texto completo oficial de DSH.",
				"card.unavailable": "Espacio de nombres de configuración no disponible: verifique que el plugin esté ensamblado en el perfil.",
				"card.readonly": "Solo lectura",
				"card.enabled": "Habilitar búsqueda de sesiones",
				"card.enabled.desc": "Mostrar la entrada «Buscar» en la parte inferior de la barra lateral.",
				"card.defaultMode": "Modo de búsqueda predeterminado",
				"card.defaultMode.desc": "Modo en que se abre el panel.",
				"card.mode.title": "Título",
				"card.mode.content": "Contenido",
				"card.autoSync": "Sincronización automática del índice",
				"card.autoSync.desc": "Sincroniza incrementalmente los registros de sesión al índice independiente en segundo plano.",
				"card.syncInterval": "Intervalo de sincronización (segundos)",
				"card.syncInterval.desc": "Intervalo mínimo entre dos sincronizaciones incrementales.",
				"card.archiveKeep": "Archivos a conservar",
				"card.archiveKeep.desc": "Cuántos archivos de índice archivados se conservan en cada reconstrucción.",
				"card.index": "Índice de búsqueda de contenido",
				"card.index.desc": "Índice listo: {indexed} sesiones recopiladas.",
				"card.index.archives": ", {archives} archivo(s) de respaldo.",
				"card.index.empty": "El índice independiente aún no está construido. Haga clic en «Reconstruir índice» para crearlo desde los registros de sesión.",
				"card.index.reading": "Leyendo estado del índice…",
				"card.index.rebuilding": "Reconstruyendo índice… {done}/{total} (el índice anterior sigue activo durante la reconstrucción)",
				"card.index.syncing": "Sincronizando índice…",
				"card.index.failures": "{count} sesión(es) fallaron al sincronizar (ver registros del Host).",
				"card.index.rebuildError": "Reconstrucción fallida: {error}",
				"card.index.rebuild": "Reconstruir índice",
				"card.index.rebuilding.btn": "Reconstruyendo…",
				"card.index.rebuild.hint": "No destructivo: el índice anterior sigue activo mientras se construye el nuevo; el intercambio es atómico y el índice anterior se archiva.",
				"card.index.archivedOwner": "La consulta y eliminación de sesiones archivadas corresponde a dsh-session-steward. Este plugin solo lee el conjunto archivado y excluye esas sesiones del índice.",
				"card.index.archivedMissing": "La consulta y eliminación de sesiones archivadas requiere dsh-session-steward, que no está instalado. Este plugin solo lee el conjunto archivado y excluye esas sesiones del índice.",
				"card.index.export": "Exportar instantánea",
				"card.index.import": "Importar instantánea",
				"card.index.exported": "Instantánea descargada.",
				"card.index.import.started": "Importación iniciada: el índice se reconstruye en segundo plano y se intercambia al finalizar.",
				"card.index.importParse": "Error al analizar la instantánea o sin sesiones válidas.",
				"card.action.failed": "Acción fallida: {error}",
				"panel.titleSearch": "Título",
				"panel.contentSearch": "Contenido",
				"panel.searchTitle": "Buscar títulos de sesión…",
				"panel.searchContent": "Buscar contenido de sesión…",
				"panel.entry": "Buscar",
				"panel.buildIndex": "Construir índice",
				"panel.archived": "{count} sesión(es) archivada(s) excluida(s)",
				"panel.rebuilding": "Reconstruyendo índice… {done}/{total} (el índice anterior sigue activo)",
				"panel.unavailable": "Servicio de índice independiente no disponible: Host no inicializado.",
				"panel.notBuilt": "Índice independiente no construido: constrúyalo para habilitar la búsqueda de contenido (no se requiere índice FTS oficial).",
				"panel.loadingSessions": "Cargando sesiones…",
				"panel.sessionsError": "Error al cargar sesiones: {error}",
				"panel.noSessions": "Sin sesiones",
				"panel.noMatch": "Sin sesiones coincidentes.",
				"panel.loadingContent": "Buscando en el contenido…",
				"panel.contentError": "Búsqueda de contenido fallida: {error}",
				"panel.noContent": "Sin contenido coincidente.",
				"panel.contentHint": "Escriba palabras clave para buscar contenido.",
				"panel.noText": "(sin texto)",
				"panel.untitled": "(sin título)",
				"panel.openSession": "Abrir sesión",
				"panel.footer.invoke": "Abrir",
				"panel.footer.close": "Cerrar",
				"filter.all": "Todos",
				"filter.user": "Usuario",
				"filter.reply": "Respuesta",
				"filter.tool": "Herramienta",
				"sort.label": "Orden de resultados",
				"sort.relevance": "Relevancia",
				"sort.time": "Tiempo",
				"sort.relevance.hint": "Ordenar por fuerza de coincidencia (predeterminado).",
				"sort.time.hint": "Ordenar por última actividad, más reciente primero; en caso de empate, por fuerza de coincidencia.",
				"type.user/message": "Usuario",
				"type.assistant/message": "Respuesta",
				"type.tool/call": "Llamada de herramienta",
				"type.tool/result": "Resultado de herramienta"
			}
		};
		/** Translate with {param} interpolation; falls back to zh, then the key itself. */
		function translate$1(locale, key, params) {
			const raw = locale?.(key, params);
			if (typeof raw === "string" && raw !== "" && raw !== key) return raw;
			const template = dictionaries.zh[key] ?? key;
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/gu, (_, name) => String(params[name] ?? `{${name}}`));
		}
		//#endregion
		//#region src/client/search/manage.tsx
		/**
		* 批量管理台（workspace 视角）—— 管家面板「管理」页签的主体。
		*
		* beta.5 评审:管理是管家职能,不该出现在搜索面板的模式切换里;本组件从
		* search/panel.tsx 抽出,挂在 StewardPanel 第三页签。样式自带注入（幂等）,
		* 与搜索面板是否启用解耦。
		*
		* 数据面:list-sessions 读统一索引语料（活跃+归档,archived 随行）;
		* 动作面:session-history-archive / prune / purge（写官方存储文件,重启后
		* 侧栏完全生效——宿主半在成功路径上已同步联动索引）。
		*/
		/** 样式（幂等注入;类名沿用 dsws_ 前缀,与搜索面板共享视觉语言）。 */
		function injectManageStyles() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector("style[data-plugin-css=\"dsh-session-steward/manage\"]") !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-steward";
			tag.dataset.pluginCss = "dsh-session-steward/manage";
			tag.textContent = `
.dsws_manageList{flex:1 1 auto;min-height:0;overflow-y:auto;margin:8px 0 0;padding:0 6px 8px}
.dsws_group{margin-bottom:6px}
.dsws_groupHead{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--dsw-specific-tip);border-bottom:1px solid var(--dsw-alias-border-l2);cursor:pointer;user-select:none}
.dsws_groupTitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.dsws_groupCount{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;font-variant-numeric:tabular-nums}
.dsws_check{flex:none;display:inline-flex;align-items:center}
.dsws_check input{width:13px;height:13px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}
.dsws_tagArch{flex:none;color:var(--dsw-alias-state-warn-label,var(--dsw-alias-label-caption));font-size:10px;line-height:16px;border:1px solid currentColor;border-radius:999px;padding:0 6px;white-space:nowrap}
.dsws_batchBar{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsws_batchInfo{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsws_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dsws_manageHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:8px 10px 0}
.dsws_chips{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex:none}
.dsws_chip{height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;line-height:22px;white-space:nowrap}
.dsws_chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_chipActive{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
`;
			document.head.appendChild(tag);
			return () => {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}
		/** 批量管理台主体（自持语料/勾选/批量状态）。 */
		function ManageConsole({ t, open }) {
			const [sessions, setSessions] = (0, react.useState)(null);
			const [sessionsError, setSessionsError] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [batch, setBatch] = (0, react.useState)({
				busy: false,
				message: "",
				ok: true
			});
			const [confirmPurge, setConfirmPurge] = (0, react.useState)(false);
			const [domain, setDomain] = (0, react.useState)("all");
			const [favorites, setFavorites] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [favoritesOnly, setFavoritesOnly] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				callSteward("session-history-favorites-list", {}).then((res) => {
					if (cancelled || !res.ok || !Array.isArray(res.favorites)) return;
					setFavorites(new Set(res.favorites));
				});
				return () => {
					cancelled = true;
				};
			}, []);
			/** 星标切换:写 host 收藏域,就地更新本地集合。 */
			const toggleFavorite = (sessionId) => {
				const next = !favorites.has(sessionId);
				setFavorites((prev) => {
					const copy = new Set(prev);
					if (next) copy.add(sessionId);
					else copy.delete(sessionId);
					return copy;
				});
				callSteward("session-history-favorite-set", {
					sessionId,
					favorite: next
				});
			};
			(0, react.useEffect)(() => {
				if (sessions !== null) return;
				let cancelled = false;
				callHost("list-sessions", {}).then((res) => {
					if (cancelled) return;
					if (res.ok) {
						setSessions(res.items);
						setSelected(/* @__PURE__ */ new Set());
						setConfirmPurge(false);
					} else setSessionsError(res.error ?? "读取会话列表失败");
				});
				return () => {
					cancelled = true;
				};
			}, [sessions]);
			const manageGroups = (0, react.useMemo)(() => {
				if (sessions === null) return [];
				const byCwd = /* @__PURE__ */ new Map();
				for (const item of sessions) {
					if (domain === "active" && item.archived === true) continue;
					if (domain === "archived" && item.archived !== true) continue;
					if (favoritesOnly && !favorites.has(item.sessionId)) continue;
					const list = byCwd.get(item.cwd);
					if (list === void 0) byCwd.set(item.cwd, [item]);
					else list.push(item);
				}
				return [...byCwd.entries()].sort((a, b) => (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) || a[0].localeCompare(b[0])).map(([cwd, items]) => ({
					cwd,
					items
				}));
			}, [
				sessions,
				domain,
				favoritesOnly,
				favorites
			]);
			/** 批量动作;删除两步确认。 */
			const runBatch = (kind) => {
				const ids = [...selected];
				if (ids.length === 0 || batch.busy) return;
				if (kind === "purge" && !confirmPurge) {
					setConfirmPurge(true);
					return;
				}
				setConfirmPurge(false);
				setBatch({
					busy: true,
					message: "",
					ok: true
				});
				callSteward(kind === "archive" ? "session-history-archive" : kind === "unarchive" ? "session-history-prune" : "session-history-purge", { sessionIds: ids }).then((res) => {
					const base = !res.ok ? translate$1(t, "manage.done.error", { error: res.error ?? "?" }) : kind === "archive" ? translate$1(t, "manage.done.archive", { n: res.added ?? ids.length }) : kind === "unarchive" ? translate$1(t, "manage.done.unarchive", { n: res.removed ?? ids.length }) : translate$1(t, "manage.done.purge", { n: res.purged ?? ids.length });
					const message = res.ok === true && res.requiresRestart === true ? `${base} ${translate$1(t, "manage.done.restart")}` : base;
					setBatch({
						busy: false,
						message,
						ok: res.ok === true
					});
					if (res.ok) {
						setSelected(/* @__PURE__ */ new Set());
						setSessions(null);
					}
				});
			};
			const toggleOne = (sessionId) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(sessionId)) next.delete(sessionId);
					else next.add(sessionId);
					return next;
				});
			};
			const toggleGroup = (items) => {
				setSelected((prev) => {
					const next = new Set(prev);
					const allIn = items.every((item) => next.has(item.sessionId));
					for (const item of items) if (allIn) next.delete(item.sessionId);
					else next.add(item.sessionId);
					return next;
				});
			};
			(0, react.useEffect)(() => {
				injectManageStyles();
			}, []);
			if (sessionsError !== null) return (0, react.createElement)("div", { className: "dsws_error" }, sessionsError);
			if (sessions === null) return (0, react.createElement)("div", { className: "dsws_status" }, translate$1(t, "panel.loadingSessions"));
			if (manageGroups.length === 0) return (0, react.createElement)("div", { className: "dsws_empty" }, translate$1(t, "panel.noSessions"));
			const children = [
				(0, react.createElement)("div", {
					key: "chips",
					className: "dsws_chips",
					role: "group",
					"aria-label": translate$1(t, "domain.all")
				}, [...[
					"all",
					"active",
					"archived"
				].map((id) => (0, react.createElement)("button", {
					key: id,
					type: "button",
					className: `dsws_chip${domain === id ? " dsws_chipActive" : ""}`,
					"aria-pressed": domain === id,
					onClick: () => {
						setDomain(id);
					}
				}, translate$1(t, `domain.${id}`))), (0, react.createElement)("button", {
					key: "favorites",
					type: "button",
					className: `dsws_chip${favoritesOnly ? " dsws_chipActive" : ""}`,
					"aria-pressed": favoritesOnly,
					onClick: () => {
						setFavoritesOnly((v) => !v);
					}
				}, `★ ${translate$1(t, "filter.favorites")}`)]),
				(0, react.createElement)("div", {
					key: "hint",
					className: "dsws_manageHint"
				}, [translate$1(t, "manage.hint"), (0, react.createElement)("span", {
					key: "sep",
					style: {
						display: "block",
						marginTop: "2px"
					}
				}, translate$1(t, "manage.restartHint"))]),
				(0, react.createElement)("div", {
					key: "groups",
					className: "dsws_manageList"
				}, ...manageGroups.map((group) => (0, react.createElement)("div", {
					key: group.cwd === "" ? "(nocwd)" : group.cwd,
					className: "dsws_group"
				}, [(0, react.createElement)("div", {
					key: "head",
					className: "dsws_groupHead",
					title: translate$1(t, "manage.selectGroup"),
					onClick: () => {
						toggleGroup(group.items);
					}
				}, [
					(0, react.createElement)("span", {
						key: "check",
						className: "dsws_check"
					}, (0, react.createElement)("input", {
						type: "checkbox",
						checked: group.items.length > 0 && group.items.every((item) => selected.has(item.sessionId)),
						onChange: () => {
							toggleGroup(group.items);
						},
						onClick: (e) => {
							e.stopPropagation();
						}
					})),
					(0, react.createElement)("span", {
						key: "title",
						className: "dsws_groupTitle"
					}, group.cwd === "" ? translate$1(t, "manage.group.nocwd") : group.cwd),
					(0, react.createElement)("span", {
						key: "count",
						className: "dsws_groupCount"
					}, `${group.items.length}`)
				]), ...group.items.map((item) => (0, react.createElement)("button", {
					key: item.sessionId,
					type: "button",
					className: "dsws_row",
					onClick: () => {
						open(item.sessionId);
					}
				}, [(0, react.createElement)("span", {
					key: "line",
					className: "dsws_rowTitle"
				}, [
					(0, react.createElement)("span", {
						key: "check",
						className: "dsws_check"
					}, (0, react.createElement)("input", {
						type: "checkbox",
						checked: selected.has(item.sessionId),
						onChange: () => {
							toggleOne(item.sessionId);
						},
						onClick: (e) => {
							e.stopPropagation();
						}
					})),
					(0, react.createElement)("button", {
						key: "star",
						type: "button",
						className: "dsws_check",
						title: translate$1(t, favorites.has(item.sessionId) ? "star.on" : "star.off"),
						style: {
							border: "none",
							background: "transparent",
							cursor: "pointer",
							fontSize: "13px",
							lineHeight: 1,
							padding: "0 2px",
							color: favorites.has(item.sessionId) ? "var(--dsw-alias-state-warn-label, #d97706)" : "var(--dsw-alias-label-caption)"
						},
						onClick: (e) => {
							e.stopPropagation();
							toggleFavorite(item.sessionId);
						}
					}, favorites.has(item.sessionId) ? "★" : "☆"),
					(0, react.createElement)("span", {
						key: "x",
						className: "dsws_titleText"
					}, item.title || translate$1(t, "panel.untitled")),
					item.archived === true && (0, react.createElement)("span", {
						key: "arch",
						className: "dsws_tagArch"
					}, translate$1(t, "tag.archived")),
					(0, react.createElement)("span", {
						key: "tag",
						className: "dsws_tag"
					}, fmtTime$1(item.updatedAt))
				]), (0, react.createElement)("span", {
					key: "meta",
					className: "dsws_meta"
				}, item.cwd)]))])))
			];
			if (selected.size > 0) children.push((0, react.createElement)("div", {
				key: "batch",
				className: "dsws_batchBar"
			}, [
				(0, react.createElement)("span", {
					key: "info",
					className: "dsws_batchInfo"
				}, batch.message !== "" ? batch.message : translate$1(t, "manage.selected", { n: selected.size })),
				(0, react.createElement)("button", {
					key: "archive",
					type: "button",
					className: "dsws_actBtn",
					disabled: batch.busy,
					onClick: () => {
						runBatch("archive");
					}
				}, translate$1(t, "manage.batch.archive")),
				(0, react.createElement)("button", {
					key: "unarchive",
					type: "button",
					className: "dsws_actBtn",
					disabled: batch.busy,
					onClick: () => {
						runBatch("unarchive");
					}
				}, translate$1(t, "manage.batch.unarchive")),
				(0, react.createElement)("button", {
					key: "purge",
					type: "button",
					className: `dsws_actBtn dsws_btnDanger`,
					disabled: batch.busy,
					style: confirmPurge ? {
						background: "var(--dsw-alias-state-error-primary)",
						color: "var(--dsw-specific-tip)"
					} : void 0,
					onClick: () => {
						runBatch("purge");
					}
				}, confirmPurge ? translate$1(t, "manage.batch.confirm") : translate$1(t, "manage.batch.delete")),
				batch.busy && (0, react.createElement)("span", {
					key: "busy",
					className: "dsws_batchInfo"
				}, translate$1(t, "manage.batch.working"))
			]));
			return (0, react.createElement)("div", {
				className: "dsws_manageRoot",
				style: {
					display: "flex",
					flexDirection: "column",
					flex: "1 1 auto",
					minHeight: 0
				}
			}, children);
		}
		/** Format an epoch-ms timestamp: today → HH:mm, else YYYY-MM-DD HH:mm. */
		function fmtTime$1(ms) {
			if (!ms || typeof ms !== "number") return "";
			try {
				const d = new Date(ms);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
				const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
				if (sameDay) return time;
				return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
			} catch {
				return "";
			}
		}
		//#endregion
		//#region src/client/panel.tsx
		/**
		* 会话管家面板壳：一个侧边栏入口，两个页签（养老院 / 体检）。
		*
		* 页签可见性由开关决定：`historyFiles=false` 时「养老院」消失，`healthCheck=false`
		* 时「体检」消失；两者都关时进入面板直接显示空壳提示（客户端也会隐藏入口）。
		*/
		/** 页签 id（导出供测试断言）。 */
		const TAB_HISTORY = "dss-tab-history";
		const TAB_HEALTH = "dss-tab-health";
		const TAB_MANAGE = "dss-tab-manage";
		/** 会话管家对话框。 */
		function StewardPanel({ t, historyFiles, healthCheck, searchEnabled = false, openSession, onClose }) {
			const [tab, setTab] = (0, react.useState)(historyFiles ? "history" : healthCheck ? "health" : "manage");
			(0, react.useEffect)(() => {
				if (tab === "history" && !historyFiles && (healthCheck || searchEnabled)) setTab(healthCheck ? "health" : "manage");
				if (tab === "health" && !healthCheck && (historyFiles || searchEnabled)) setTab(historyFiles ? "history" : "manage");
				if (tab === "manage" && !searchEnabled && historyFiles) setTab("history");
			}, [
				tab,
				historyFiles,
				healthCheck,
				searchEnabled
			]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const tabs = [];
			if (historyFiles) tabs.push((0, react.createElement)("button", {
				key: TAB_HISTORY,
				id: TAB_HISTORY,
				type: "button",
				className: `dss_tab${tab === "history" ? " dss_tabActive" : ""}`,
				"aria-selected": tab === "history",
				onClick: () => {
					setTab("history");
				}
			}, translate(t, "panel.tab.history")));
			if (healthCheck) tabs.push((0, react.createElement)("button", {
				key: TAB_HEALTH,
				id: TAB_HEALTH,
				type: "button",
				className: `dss_tab${tab === "health" ? " dss_tabActive" : ""}`,
				"aria-selected": tab === "health",
				onClick: () => {
					setTab("health");
				}
			}, translate(t, "panel.tab.health")));
			if (searchEnabled) tabs.push((0, react.createElement)("button", {
				key: TAB_MANAGE,
				id: TAB_MANAGE,
				type: "button",
				className: `dss_tab${tab === "manage" ? " dss_tabActive" : ""}`,
				"aria-selected": tab === "manage",
				onClick: () => {
					setTab("manage");
				}
			}, translate(t, "panel.tab.manage")));
			const body = tab === "history" && historyFiles ? (0, react.createElement)(HistoryPanel, {
				t,
				onClose
			}) : tab === "health" && healthCheck ? (0, react.createElement)(HealthPanel, {
				t,
				onClose
			}) : tab === "manage" && searchEnabled ? (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				flex: "1 1 auto",
				minHeight: 0
			} }, (0, react.createElement)(ManageConsole, { open: openSession ?? (() => {}) })) : (0, react.createElement)("div", { className: "dss_empty" }, translate(t, "card.enabled.desc"));
			return (0, react_dom.createPortal)((0, react.createElement)("div", { key: "steward-root" }, [(0, react.createElement)("div", {
				key: "backdrop",
				className: "dss_backdrop",
				onClick: onClose
			}), (0, react.createElement)("div", {
				key: "panel",
				className: "dss_panel",
				role: "dialog",
				"aria-label": translate(t, "panel.title"),
				style: {
					display: "flex",
					flexDirection: "column"
				}
			}, [(0, react.createElement)("div", {
				key: "head",
				className: "dss_dialogHead"
			}, [
				(0, react.createElement)("span", {
					key: "title",
					className: "dss_dialogTitle"
				}, translate(t, "panel.title")),
				(0, react.createElement)("span", {
					key: "tabs",
					className: "dss_tabRow"
				}, tabs),
				(0, react.createElement)("button", {
					key: "close",
					type: "button",
					className: "dss_actBtn",
					onClick: onClose
				}, translate(t, "panel.close"))
			]), body])]), document.body);
		}
		/** 侧边栏脚部入口：宽栏带文案成行控件，收起轨道退化为 36x36 图标钮。 */
		function StewardFooter(props) {
			const wide = props.wide === true;
			return (0, react.createElement)("button", {
				type: "button",
				className: wide ? "dss_footerEntry" : "dss_footerEntry dss_footerEntryRail",
				title: props.title,
				"aria-label": props.title,
				onClick: props.onClick
			}, [(0, react.createElement)("span", {
				key: "icon",
				className: "dss_footerIcon",
				"aria-hidden": true
			}, "🧭"), wide && props.label !== void 0 ? (0, react.createElement)("span", {
				key: "label",
				className: "dss_footerLabel"
			}, props.label) : null]);
		}
		//#endregion
		//#region src/client/search/platform.ts
		/**
		* Resolve the running platform string, three tiers deep.
		*
		* 1. UA-CH (`navigator.userAgentData.platform`) — modern and precise.
		* 2. `navigator.platform` — broadly available, deprecated, and empty in some
		*    privacy modes.
		* 3. The UA string — last resort, still non-empty in practice.
		*
		* @param nav - the navigator to read; `undefined` is allowed (non-DOM host).
		* @returns a lower-cased platform string, or `''` when nothing could be read.
		*/
		function detectPlatform(nav) {
			const chPlatform = nav?.userAgentData?.platform;
			if (typeof chPlatform === "string" && chPlatform !== "") return chPlatform.toLowerCase();
			const legacy = nav?.platform;
			if (typeof legacy === "string" && legacy !== "") return legacy.toLowerCase();
			const agent = nav?.userAgent;
			if (typeof agent === "string" && agent !== "") return agent.toLowerCase();
			return "";
		}
		/**
		* Derive the label vocabulary from a platform string.
		*
		* An unrecognised platform — an empty string, or a UA that names neither
		* system — takes the non-Mac vocabulary on purpose: `Ctrl` is legible to
		* everyone, while `⌘` is opaque to anyone who has never used a Mac.
		*
		* @param platform - the string produced by {@link detectPlatform}.
		* @returns the label vocabulary for that platform.
		*/
		function platformLabels(platform) {
			const isMac = /mac|iphone|ipad|ipod/u.test(platform);
			const isWindows = /win/u.test(platform);
			const modLabel = isMac ? "⌘" : "Ctrl";
			return {
				platform,
				isMac,
				isWindows,
				modLabel,
				altLabel: isMac ? "⌥" : "Alt",
				shiftLabel: isMac ? "⇧" : "Shift",
				enterLabel: "↵",
				escLabel: isMac ? "esc" : "Esc",
				invokeLabel: isMac ? `${modLabel}K` : `${modLabel} K`
			};
		}
		/** Read `globalThis.navigator` without assuming a DOM (or a DOM lib). */
		function currentNavigator() {
			const candidate = globalThis.navigator;
			if (candidate === null || typeof candidate !== "object") return void 0;
			return candidate;
		}
		/** The labels for the platform this bundle is running on. */
		const LABELS = platformLabels(detectPlatform(currentNavigator()));
		/**
		* Whether a keydown event is the invoke chord advertised by
		* {@link PlatformLabels.invokeLabel}.
		*
		* The hint and the binding have to agree: a footer promising `⌘K` while the
		* handler matches `Ctrl+K` is worse than showing no hint at all. Both sides
		* call this, so neither can be changed alone. Requiring the other modifier to
		* be *absent* keeps the two chords distinct instead of letting either one
		* satisfy both platforms.
		*
		* @param event - the keydown payload.
		* @param isMac - the running platform's macOS-ness, from {@link LABELS}.
		* @returns `true` when the event is the invoke chord.
		*/
		function isInvokeChord(event, isMac) {
			if (event.key !== "k" && event.key !== "K") return false;
			if (event.altKey || event.shiftKey) return false;
			return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
		}
		//#endregion
		//#region src/client/search/panel.tsx
		/**
		* 搜索子域 client 组件（原 dsh-search-index client 半身的面板部分）。
		*
		* 注册职责（侧栏入口 / 家族 tab / 插件页配置卡）在合并包的 client/index.ts；
		* 本文件只持有：样式表、悬浮搜索面板（标题/内容双模式）、侧栏 footer 按钮、
		* 唤出和弦绑定。
		*
		* The `locale` and config services are consumed structurally: when
		* the host release lacks them the footer falls back to the bundled zh
		* dictionary and the host-composition config layer.
		*/
		/** The coarse filter chips rendered above content results. */
		const CONTENT_TYPE_CHIPS = [
			{
				id: "all",
				labelKey: "filter.all"
			},
			{
				id: "user",
				labelKey: "filter.user"
			},
			{
				id: "reply",
				labelKey: "filter.reply"
			},
			{
				id: "tool",
				labelKey: "filter.tool"
			}
		];
		/** 检索域 chips（标题/内容两模式共用）。 */
		const ARCHIVED_CHIPS = [
			{
				id: "all",
				labelKey: "domain.all"
			},
			{
				id: "active",
				labelKey: "domain.active"
			},
			{
				id: "archived",
				labelKey: "domain.archived"
			}
		];
		/** Result-ordering chips rendered at the right of the same filter row. */
		const SORT_CHIPS = [{
			id: "relevance",
			labelKey: "sort.relevance"
		}, {
			id: "time",
			labelKey: "sort.time"
		}];
		/**
		* The identity of one content-search request, derived from every input that
		* changes the result set.
		*
		* This is the single owner of that identity. The effect that issues the
		* request and the render path that decides whether the stored result belongs
		* to the current inputs must both come through here: two hand-written copies
		* of the same template literal drift apart silently, and the render path then
		* falls through to its empty `loading` state for every query — results arrive,
		* parse, and are never shown.
		*
		* @param normalized - the trimmed query text.
		* @param contentType - the active content-type filter.
		* @param sortBy - the active result ordering.
		* @param archivedFilter - the retrieval-domain chip (all/active/archived).
		* @returns an opaque key, stable for equal inputs.
		*/
		function contentRequestKey(normalized, contentType, sortBy, archivedFilter, dateRange) {
			return `${normalized}\u0000${contentType}\u0000${sortBy}\u0000${archivedFilter}\u0000${dateRange.from}\u0000${dateRange.to}`;
		}
		/**
		* Persisted ordering preference. Unlike `lastPanelMode` this one survives a
		* page reload — an ordering is a durable preference, not a session mood.
		*/
		const SORT_STORE_KEY = "dsh-search-index.sortBy";
		/** Read the persisted ordering; private mode or a bad value degrades to relevance. */
		function readStoredSort() {
			try {
				return window.localStorage.getItem(SORT_STORE_KEY) === "time" ? "time" : "relevance";
			} catch {
				return "relevance";
			}
		}
		/** Persist the ordering; a storage failure still leaves this session working. */
		function writeStoredSort(next) {
			try {
				window.localStorage.setItem(SORT_STORE_KEY, next);
			} catch {}
		}
		/**
		* Local re-sort so the page honours the chosen ordering even against an older
		* host half that ignores `sortBy` and therefore omits `updatedAt` entirely —
		* in that case the host order is left untouched rather than scrambled to NaN.
		*/
		function sortHits(items, sortBy) {
			if (sortBy !== "time") return [...items];
			if (!items.every((item) => typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt))) return [...items];
			return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
		}
		/** Last panel mode used this web session (mode memory, not persisted). */
		let lastPanelMode = "title";
		/** ------------------------------------------------------------------ styles */
		const CSS = `
/* 侧栏 footer 槽位公约（2026-09-26；2026-10-01 收紧行距并强制居中）：一行多
   入口（第三方 dsh-context 等）会互相挤占 —— 宿主 .footerActions 是 nowrap
   flex 行。这里允许容器换行，并把本插件入口钉成独占一整行（flex-basis:100%）；
   其余入口（含第三方）自然落到后续行。justify-content:center 让行内所有入口
   （含不占满行的）统一居中；row-gap:0 配合入口自身 32px 高度压缩纵向占位。
   类名用 [class*=] 中段匹配：宿主是 CSS Module 哈希类名（实测形如
   hHd-Xa_footerActions —— <hash>_<name>，哈希在前），中段跨版本稳定。 */
[class*="footerActions"]{flex-wrap:wrap;justify-content:center;row-gap:0;height:auto;min-height:0}
/* —— 第三方矫正：dsh-context「上下文洞察」入口（2026-10-01）——
   .lc-ov-entry 按"独占整行"设计（width:calc(100% + 4px)、无 justify-content、
   42px 高、不对称 padding），与本槽位公约（每个入口独占一行、行内居中、32px）
   冲突，表现为文字靠左、纵向松散。这里按公约强制矫正；:not() 排除收起轨道的
   36px 圆钮形态。lc-ov-* 是 dsh-context 源码硬编码类名（非构建哈希），跨版本
   稳定（实测 0.56.1 / 0.60.0 规则一致）。 */
.lc-ov-entry:not(.lc-ov-entry-rail){width:auto!important;flex:0 0 100%!important;min-width:0!important;justify-content:center!important;height:32px!important;margin:0!important;padding:0 10px!important}
.lc-ov-entry-label{flex:0 1 auto!important}
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 100%;width:100%;min-width:0;container-type:inline-size}
/* 收起轨道：回落自然宽度（根类的 100% 基准只属于宽栏形态），放弃收缩。 */
.dsws_rootRail{flex:none;width:auto;container-type:normal}
/* 高度 32px（内容 22px 行高 + 上下各 5px）：宿主默认 42px 的上下裕度在
   多行堆叠后过于松散；左右内边距对称（10px/10px），否则整行居中时按钮内容
   会因不对称 padding 向左偏 1px。 */
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;flex:0 0 auto;min-width:0;gap:8px;height:32px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_buttonRail{flex:none;width:28px;height:28px;padding:0;gap:0;justify-content:center;border-radius:50%}
.dsws_button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_button svg{flex:none}
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:860px;max-width:calc(100vw - 32px);max-height:min(84vh,880px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.16));overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
.dsws_toolrow{display:flex;align-items:center;gap:8px;padding:10px 10px 0}
.dsws_mode{display:inline-flex;align-items:center;gap:2px;flex:none;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px}
.dsws_modeBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font-size:12px;font-weight:500;line-height:20px}
.dsws_modeBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_modeBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_search{flex:auto;min-width:0;height:30px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;outline:none;padding:0 10px;font:inherit;font-size:13px;line-height:20px}
.dsws_search:focus{border-color:var(--dsw-alias-state-business-primary)}
.dsws_search::placeholder{color:var(--dsw-alias-label-caption)}
.dsws_chips{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex:none}
.dsws_chipGap{flex:1;min-width:0}
.dsws_sortGroup{display:flex;align-items:center;gap:6px;flex:none}
.dsws_chip{height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;line-height:22px;white-space:nowrap}
.dsws_chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_chipActive{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
.dsws_list{flex:1 1 auto;min-height:0;overflow-y:auto;margin:8px 0 0;padding:0 6px 8px;list-style:none}
.dsws_row{box-sizing:border-box;border-radius:8px;width:100%;padding:7px 8px;cursor:pointer;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:2px;min-width:0}
.dsws_row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_rowTitle{display:flex;align-items:center;gap:8px;min-width:0}
.dsws_titleText{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:18px}
.dsws_tag{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsws_snippet{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsws_meta{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsws_status{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_error{color:var(--dsw-alias-state-error-primary);padding:8px;font-size:12px;line-height:18px}
.dsws_empty{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_backdrop{position:fixed;inset:0;z-index:2147482999;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));backdrop-filter:blur(var(--dsw-mask-blur,4px))}
.dsws_setRow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsws_setRow:last-child{border-bottom:none}
.dsws_setText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsws_setTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dsws_setDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsws_seg{display:inline-flex;align-items:center;gap:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px;flex:none}
.dsws_segBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px;font-weight:500;line-height:20px}
.dsws_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_segBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_segBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_actBtn{height:26px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:0 10px;font-size:12px;line-height:24px;white-space:nowrap}
.dsws_actBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_actBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_btnRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsws_progressWrap{display:flex;flex-direction:column;gap:4px;padding:8px 10px 0}
.dsws_progress{height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.dsws_progressFill{height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary);transition:width .4s ease}
.dsws_progressLabel{color:var(--dsw-alias-state-business-primary);font-size:12px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums}
.dsws_panelFoot{flex:none;display:flex;align-items:center;gap:14px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.dsws_footItem{display:inline-flex;align-items:center}
.dsws_footItem>.dsws_kbd{margin-right:5px}
.dsws_footGap{flex:1;min-width:0}
.dsws_buttonLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsws_kbd{flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:18px;width:auto;height:18px;padding:0 4px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
/*
 * The row shares its width with the session-steward entry (order 12), so at
 * narrow sidebar widths the shortcut chip, not the label, is what yields: the
 * chip is a hint repeated by the entry tooltip and the panel footer, while the
 * label is the entry's identity. Measured in Chrome: the pair needs 230px for
 * both labels plus the chip; below that the chip's 43px is what makes the
 * difference. The query is scoped to the wide form: container-type also
 * applies inline-size containment, which zeroes a flex:none rail root.
 */
@container (max-width: 132px){.dsws_kbd{display:none}}
.dsws_pill{flex:none;display:inline-grid;grid-template-columns:14px max-content;align-items:center;column-gap:4px;height:26px;padding:0 10px;box-sizing:border-box;border:none;border-radius:8px;font-size:12px;font-weight:500;line-height:18px;white-space:nowrap;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_pill .dsws_pillIcon{display:grid;place-items:center;width:14px;height:14px}
.dsws_pill .dsws_pillLabel{display:grid;text-align:left}
.dsws_pill .dsws_pillLabel>span{grid-area:1/1}
.dsws_pillReady{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dsws_pillWarn{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.dsws_pillError{background:var(--dsw-alias-state-error-tertiary,var(--dsw-alias-state-warn-tertiary));color:var(--dsw-alias-state-error-primary,var(--dsw-alias-state-warn-label))}
.dsws_pillNeutral{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsws_pillDots span{opacity:0;animation:dsws-reveal-dot 1.5s step-end infinite}
.dsws_pillDots span:nth-child(2){animation-delay:.5s}
.dsws_pillDots span:nth-child(3){animation-delay:1s}
@keyframes dsws-reveal-dot{0%,32%{opacity:0}33%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.dsws_pillDots span{animation:none;opacity:1}}
`;
		/** Inject the plugin stylesheet once per activation (removed on disposal). */
		function injectStyles$1() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector("style[data-plugin-css=\"dsw-session-search-toggle/styles\"]") !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-search-index";
			tag.dataset.pluginCss = "dsw-session-search-toggle/styles";
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}
		/** ------------------------------------------------------------------ view */
		/** The floating search panel. */
		function SwitchPanel({ t, onClose, open }) {
			const [mode, setModeState] = (0, react.useState)(lastPanelMode);
			const setMode = (next) => {
				lastPanelMode = next;
				setModeState(next);
			};
			const [query, setQuery] = (0, react.useState)("");
			const [contentType, setContentType] = (0, react.useState)("all");
			const [archivedFilter, setArchivedFilter] = (0, react.useState)("all");
			const [dateFrom, setDateFrom] = (0, react.useState)("");
			const [dateTo, setDateTo] = (0, react.useState)("");
			const [sortBy, setSortByState] = (0, react.useState)(readStoredSort);
			const setSortBy = (next) => {
				writeStoredSort(next);
				setSortByState(next);
			};
			const [sessions, setSessions] = (0, react.useState)(null);
			const [sessionsError, setSessionsError] = (0, react.useState)(null);
			const [content, setContent] = (0, react.useState)({
				query: "",
				status: "idle",
				items: []
			});
			const [searchStatus, setSearchStatus] = (0, react.useState)({
				available: null,
				rebuilding: false,
				done: 0,
				total: 0,
				count: 0
			});
			const inputRef = (0, react.useRef)(null);
			const listRef = (0, react.useRef)(null);
			const normalized = query.trim().toLowerCase();
			(0, react.useEffect)(() => {
				let cancelled = false;
				let timer;
				const probe = () => {
					callHostAny("index-status", {}).then((res) => {
						if (cancelled) return;
						if (!res.ok) {
							setSearchStatus({
								available: false,
								reason: "unreachable",
								rebuilding: false,
								done: 0,
								total: 0,
								count: 0
							});
							return;
						}
						const status = res;
						const rebuilding = status.rebuild?.state === "building" || status.rebuild?.state === "swapping";
						setSearchStatus({
							available: status.available ?? false,
							reason: status.reason,
							rebuilding,
							done: status.rebuild?.done ?? 0,
							total: status.rebuild?.total ?? 0,
							count: status.sync?.indexed ?? 0
						});
						if (rebuilding) timer = window.setTimeout(probe, 1500);
					});
				};
				probe();
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, []);
			const startIndexBuild = () => {
				setSearchStatus((prev) => ({
					...prev,
					rebuilding: true
				}));
				callHostAny("index-rebuild", {});
			};
			(0, react.useEffect)(() => {
				if (sessions !== null) return;
				let cancelled = false;
				callHost("list-sessions", {}).then((res) => {
					if (cancelled) return;
					if (res.ok) {
						setSessions(res.items);
						setSessionsError(null);
					} else setSessionsError(res.error ?? "读取会话列表失败");
				});
				return () => {
					cancelled = true;
				};
			}, [sessions]);
			(0, react.useEffect)(() => {
				if (mode !== "content" || normalized === "") {
					if (mode !== "content") setContent({
						query: normalized,
						status: "idle",
						items: []
					});
					return;
				}
				let cancelled = false;
				const requestType = contentType;
				const requestKey = contentRequestKey(normalized, requestType, sortBy, archivedFilter, {
					from: dateFrom,
					to: dateTo
				});
				setContent((prev) => ({
					query: requestKey,
					status: "loading",
					items: prev.query === requestKey ? prev.items : []
				}));
				const timer = window.setTimeout(() => {
					callHost("content-search", {
						query: normalized,
						limit: 50,
						types: requestType === "all" ? void 0 : [requestType],
						sortBy,
						archived: archivedFilter,
						from: dateFrom === "" ? void 0 : dateFrom,
						to: dateTo === "" ? void 0 : dateTo
					}).then((res) => {
						if (cancelled) return;
						setContent({
							query: requestKey,
							status: res.ok ? "ready" : "error",
							items: res.ok ? sortHits(res.items, sortBy) : [],
							error: res.ok ? void 0 : res.error ?? "搜索失败"
						});
					});
				}, 250);
				return () => {
					cancelled = true;
					window.clearTimeout(timer);
				};
			}, [
				mode,
				normalized,
				contentType,
				sortBy,
				archivedFilter,
				dateFrom,
				dateTo
			]);
			(0, react.useEffect)(() => {
				inputRef.current?.focus();
			}, []);
			(0, react.useEffect)(() => {
				const onKey = (e) => {
					if (e.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const dateRangeMs = (0, react.useMemo)(() => {
				const parse = (value, nextDay) => {
					if (value === "") return void 0;
					const [year, month, day] = value.split("-").map(Number);
					if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return void 0;
					const date = new Date(year, month - 1, day);
					if (nextDay) date.setDate(date.getDate() + 1);
					return date.getTime();
				};
				const from = parse(dateFrom, false);
				const to = parse(dateTo, true);
				return {
					...from === void 0 ? {} : { from },
					...to === void 0 ? {} : { to }
				};
			}, [dateFrom, dateTo]);
			const titleRows = (0, react.useMemo)(() => {
				if (sessions === null) return [];
				const byDomain = sessions.filter((item) => archivedFilter === "active" ? item.archived !== true : archivedFilter === "archived" ? item.archived === true : true);
				const byDate = byDomain.filter((item) => (dateRangeMs.from === void 0 || item.updatedAt >= dateRangeMs.from) && (dateRangeMs.to === void 0 || item.updatedAt < dateRangeMs.to));
				if (normalized === "") return byDate;
				return byDomain.filter((item) => item.title.toLowerCase().includes(normalized) || item.cwd.toLowerCase().includes(normalized));
			}, [
				sessions,
				normalized,
				archivedFilter,
				dateRangeMs
			]);
			const children = [];
			if (sessionsError !== null) children.push((0, react.createElement)("div", {
				key: "err",
				className: "dsws_error"
			}, translate$1(t, "panel.sessionsError", { error: sessionsError })));
			const activeRequestKey = contentRequestKey(normalized, contentType, sortBy, archivedFilter, {
				from: dateFrom,
				to: dateTo
			});
			const activeContent = content.query === activeRequestKey ? content : {
				query: activeRequestKey,
				status: "loading",
				items: []
			};
			if (mode === "title") {
				if (sessions === null) children.push((0, react.createElement)("div", {
					key: "loading",
					className: "dsws_status"
				}, translate$1(t, "panel.loadingSessions")));
				else if (titleRows.length === 0) children.push((0, react.createElement)("div", {
					key: "empty",
					className: "dsws_empty"
				}, normalized === "" ? translate$1(t, "panel.noSessions") : translate$1(t, "panel.noMatch")));
				else children.push((0, react.createElement)("ul", {
					key: "list",
					ref: listRef,
					className: "dsws_list",
					role: "listbox",
					"aria-label": translate$1(t, "panel.titleSearch")
				}, titleRows.slice(0, 200).map((item) => (0, react.createElement)("li", {
					key: item.sessionId,
					role: "option"
				}, (0, react.createElement)("button", {
					type: "button",
					className: "dsws_row",
					onClick: () => {
						open(item.sessionId);
					}
				}, [(0, react.createElement)("span", {
					key: "t",
					className: "dsws_rowTitle"
				}, [
					(0, react.createElement)("span", {
						key: "x",
						className: "dsws_titleText"
					}, item.title || translate$1(t, "panel.untitled")),
					item.archived === true && (0, react.createElement)("span", {
						key: "arch",
						className: "dsws_tagArch"
					}, translate$1(t, "tag.archived")),
					(0, react.createElement)("span", {
						key: "tag",
						className: "dsws_tag"
					}, fmtTime(item.updatedAt))
				]), item.cwd !== "" && (0, react.createElement)("span", {
					key: "c",
					className: "dsws_meta"
				}, item.cwd)])))));
			} else if (searchStatus.rebuilding) {
				const pct = searchStatus.total > 0 ? Math.min(100, Math.round(searchStatus.done / searchStatus.total * 100)) : void 0;
				children.push((0, react.createElement)("div", {
					key: "rebuilding",
					className: "dsws_progressWrap"
				}, [(0, react.createElement)("div", {
					key: "bar",
					className: "dsws_progress"
				}, (0, react.createElement)("div", {
					className: "dsws_progressFill",
					style: pct === void 0 ? {
						width: "30%",
						opacity: .6
					} : { width: `${pct}%` }
				})), (0, react.createElement)("span", {
					key: "label",
					className: "dsws_progressLabel"
				}, translate$1(t, "panel.rebuilding", {
					done: searchStatus.done,
					total: searchStatus.total || "?"
				}))]));
			} else if (searchStatus.available === false) children.push((0, react.createElement)("div", {
				key: "unavailable",
				className: "dsws_error"
			}, [(0, react.createElement)("div", { key: "msg" }, searchStatus.reason === "unreachable" ? "索引状态不可达：Host 半可能是旧进程。请完全重启 dsh web（浏览器刷新不重载 Host）后重试。" : searchStatus.reason === "unavailable" ? translate$1(t, "panel.unavailable") : translate$1(t, "panel.notBuilt")), (0, react.createElement)("button", {
				key: "build",
				type: "button",
				className: "dsws_actBtn",
				style: { marginTop: "6px" },
				onClick: startIndexBuild
			}, translate$1(t, "panel.buildIndex"))]));
			else if (activeContent.status === "loading") children.push((0, react.createElement)("div", {
				key: "loading",
				className: "dsws_status"
			}, translate$1(t, "panel.loadingContent")));
			else if (activeContent.status === "error") children.push((0, react.createElement)("div", {
				key: "error",
				className: "dsws_error"
			}, translate$1(t, "panel.contentError", { error: activeContent.error ?? "未知错误" })));
			else if (activeContent.items.length === 0) children.push((0, react.createElement)("div", {
				key: "empty",
				className: "dsws_empty"
			}, normalized === "" ? translate$1(t, "panel.contentHint") : translate$1(t, "panel.noContent")));
			else children.push((0, react.createElement)("ul", {
				key: "list",
				ref: listRef,
				className: "dsws_list",
				role: "listbox",
				"aria-label": translate$1(t, "panel.contentSearch")
			}, activeContent.items.slice(0, 200).map((item) => (0, react.createElement)("li", {
				key: item.sessionId,
				role: "option"
			}, (0, react.createElement)("button", {
				type: "button",
				className: "dsws_row",
				onClick: () => {
					open(item.sessionId);
				}
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dsws_rowTitle"
			}, [
				(0, react.createElement)("span", {
					key: "x",
					className: "dsws_titleText"
				}, item.title || translate$1(t, "panel.untitled")),
				(0, react.createElement)("span", {
					key: "tag",
					className: "dsws_tag"
				}, typeLabel(t, item.type)),
				(0, react.createElement)("span", {
					key: "time",
					className: "dsws_tag"
				}, fmtTime(item.updatedAt))
			]), (0, react.createElement)("span", {
				key: "s",
				className: "dsws_snippet"
			}, item.snippet || translate$1(t, "panel.noText"))])))));
			return (0, react_dom.createPortal)((0, react.createElement)("div", { key: "switch-root" }, [(0, react.createElement)("div", {
				key: "backdrop",
				className: "dsws_backdrop",
				onClick: onClose
			}), (0, react.createElement)("div", {
				key: "panel",
				className: "dsws_trigger",
				role: "dialog",
				"aria-label": translate$1(t, "card.title")
			}, [
				(0, react.createElement)("div", {
					key: "tools",
					className: "dsws_toolrow"
				}, [(0, react.createElement)("div", {
					key: "mode",
					className: "dsws_mode",
					role: "group",
					"aria-label": translate$1(t, "card.defaultMode")
				}, [(0, react.createElement)("button", {
					key: "title",
					type: "button",
					className: `dsws_modeBtn${mode === "title" ? " dsws_modeBtnActive" : ""}`,
					onClick: () => {
						setMode("title");
					}
				}, translate$1(t, "panel.titleSearch")), (0, react.createElement)("button", {
					key: "content",
					type: "button",
					className: `dsws_modeBtn${mode === "content" ? " dsws_modeBtnActive" : ""}`,
					onClick: () => {
						setMode("content");
					}
				}, translate$1(t, "panel.contentSearch"))]), (0, react.createElement)("input", {
					key: "search",
					ref: inputRef,
					className: "dsws_search",
					type: "text",
					placeholder: mode === "title" ? translate$1(t, "panel.searchTitle") : translate$1(t, "panel.searchContent"),
					value: query,
					onChange: (e) => setQuery(e.target.value)
				})]),
				(0, react.createElement)("div", {
					key: "chips",
					className: "dsws_chips",
					role: "group",
					"aria-label": translate$1(t, "domain.all")
				}, [
					...ARCHIVED_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${archivedFilter === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": archivedFilter === chip.id,
						onClick: () => {
							setArchivedFilter(chip.id);
						}
					}, translate$1(t, chip.labelKey))),
					(0, react.createElement)("input", {
						key: "from",
						type: "date",
						className: "dsws_search",
						style: {
							flex: "none",
							width: "128px",
							height: "24px",
							padding: "0 6px",
							fontSize: "12px"
						},
						value: dateFrom,
						title: translate$1(t, "date.from"),
						onChange: (e) => {
							setDateFrom(e.target.value);
						}
					}),
					(0, react.createElement)("input", {
						key: "to",
						type: "date",
						className: "dsws_search",
						style: {
							flex: "none",
							width: "128px",
							height: "24px",
							padding: "0 6px",
							fontSize: "12px"
						},
						value: dateTo,
						title: translate$1(t, "date.to"),
						onChange: (e) => {
							setDateTo(e.target.value);
						}
					}),
					...mode === "content" ? CONTENT_TYPE_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${contentType === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": contentType === chip.id,
						onClick: () => {
							setContentType(chip.id);
						}
					}, translate$1(t, chip.labelKey))) : [],
					(0, react.createElement)("span", {
						key: "gap",
						className: "dsws_chipGap"
					}),
					...mode === "content" ? [(0, react.createElement)("span", {
						key: "sort",
						className: "dsws_sortGroup",
						role: "group",
						"aria-label": translate$1(t, "sort.label")
					}, SORT_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${sortBy === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": sortBy === chip.id,
						title: chip.id === "time" ? translate$1(t, "sort.time.hint") : translate$1(t, "sort.relevance.hint"),
						onClick: () => {
							setSortBy(chip.id);
						}
					}, translate$1(t, chip.labelKey))))] : []
				]),
				children,
				(0, react.createElement)("div", {
					key: "foot",
					className: "dsws_panelFoot"
				}, [
					(0, react.createElement)("span", {
						key: "index",
						className: "dsws_footItem"
					}, [(0, react.createElement)("span", { key: "label" }, searchStatus.rebuilding ? translate$1(t, "panel.index.rebuilding", {
						done: searchStatus.done,
						total: searchStatus.total || "?"
					}) : searchStatus.available === false ? translate$1(t, "panel.index.none") : translate$1(t, "panel.index.count", { n: searchStatus.count })), (0, react.createElement)("button", {
						key: "rebuild",
						type: "button",
						className: "dsws_actBtn",
						style: {
							height: "20px",
							padding: "0 8px",
							fontSize: "11px",
							lineHeight: "18px"
						},
						disabled: searchStatus.rebuilding,
						title: translate$1(t, "card.index.rebuild.hint"),
						onClick: startIndexBuild
					}, searchStatus.rebuilding ? translate$1(t, "card.index.rebuilding.btn") : translate$1(t, "card.index.rebuild"))]),
					(0, react.createElement)("span", {
						key: "invoke",
						className: "dsws_footItem"
					}, [(0, react.createElement)("kbd", {
						key: "k",
						className: "dsws_kbd"
					}, LABELS.invokeLabel), translate$1(t, "panel.footer.invoke")]),
					(0, react.createElement)("span", {
						key: "gap",
						className: "dsws_footGap"
					}),
					(0, react.createElement)("span", {
						key: "close",
						className: "dsws_footItem"
					}, [(0, react.createElement)("kbd", {
						key: "k",
						className: "dsws_kbd"
					}, LABELS.escLabel), translate$1(t, "panel.footer.close")])
				])
			])]), document.body);
		}
		/**
		* Whether the user has the sidebar entry switched on.
		*
		* The `enabled` field has existed since the card shipped, but nothing read it:
		* the switch promised "show the search entry at the bottom of the sidebar" and
		* controlled nothing at all. Reading it here is the whole fix.
		*
		* An absent or unreadable scope keeps the entry visible — a settings service we
		* cannot read is not a user asking for the feature off, and hiding the entry
		* would also hide the only way back to the panel.
		*
		* @param scope - the bound `switch-search` namespace scope, when available.
		* @returns `false` only when a readable scope says the entry is switched off.
		*/
		function useEntryEnabled(scope) {
			return (0, react.useSyncExternalStore)((listener) => scope?.subscribe(listener) ?? (() => {}), () => scope?.getSnapshot())?.value?.enabled !== false;
		}
		/** The footer entry: one icon button that opens the search panel. */
		function SwitchFooter({ t, wide, open, scope }) {
			const [openPanel, setOpenPanel] = (0, react.useState)(false);
			const enabled = useEntryEnabled(scope);
			(0, react.useEffect)(() => {
				if (!enabled) return void 0;
				const onKey = (event) => {
					if (!isInvokeChord(event, LABELS.isMac)) return;
					event.preventDefault();
					setOpenPanel(true);
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [enabled]);
			if (!enabled) return null;
			return (0, react.createElement)("div", { className: wide ? "dsws_root" : "dsws_root dsws_rootRail" }, [(0, react.createElement)("button", {
				key: "btn",
				type: "button",
				className: wide ? "dsws_button" : "dsws_button dsws_buttonRail",
				title: `${translate$1(t, "panel.entry")}（${LABELS.invokeLabel}）`,
				"aria-label": `${translate$1(t, "panel.entry")}（${translate$1(t, "panel.titleSearch")} / ${translate$1(t, "panel.contentSearch")}，${LABELS.invokeLabel}）`,
				"aria-expanded": openPanel,
				onClick: () => {
					setOpenPanel(true);
				}
			}, [
				searchIcon(),
				wide && (0, react.createElement)("span", {
					key: "label",
					className: "dsws_buttonLabel"
				}, translate$1(t, "panel.entry")),
				wide && (0, react.createElement)("kbd", {
					key: "key",
					className: "dsws_kbd"
				}, LABELS.invokeLabel)
			]), openPanel && (0, react.createElement)(SwitchPanel, {
				key: "panel",
				t,
				onClose: () => {
					setOpenPanel(false);
				},
				open: (sessionId) => {
					setOpenPanel(false);
					open(sessionId);
				}
			})]);
		}
		/** ------------------------------------------------------------------ helpers */
		/** Format an epoch-ms timestamp: today → HH:mm, else YYYY-MM-DD HH:mm. */
		function fmtTime(ms) {
			if (!ms || typeof ms !== "number") return "";
			try {
				const d = new Date(ms);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
				const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
				if (sameDay) return time;
				return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
			} catch {
				return "";
			}
		}
		/** Short label for a content-hit event type. */
		function typeLabel(t, type) {
			if (type === "user/message" || type === "assistant/message" || type === "tool/call" || type === "tool/result") return translate$1(t, `type.${type}`);
			return type;
		}
		/** Inline search icon (stroke aligned with the product's 1.75 hairline). */
		function searchIcon() {
			return (0, react.createElement)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true
			}, (0, react.createElement)("circle", {
				cx: 7,
				cy: 7,
				r: 4.5,
				stroke: "currentColor",
				strokeWidth: 1.75,
				fill: "none"
			}), (0, react.createElement)("path", {
				d: "M10.5 10.5 L14 14",
				stroke: "currentColor",
				strokeWidth: 1.75,
				strokeLinecap: "round"
			}));
		}
		//#endregion
		//#region src/client/search/card.tsx
		/**
		* Session-search settings card（0.1.7 起不再挂载：设置表单由 host 侧 .volatile() 字段自动生成）。
		* plugin, following the dsh-thinking-levels card pattern.
		*
		* The card binds the `switch-search` settings namespace through the
		* `settingsScope` cordis service and renders its fields as one editable card:
		* the enable switch, the default panel mode, the independent-index sync
		* knobs, and the index-lifecycle block (status, the non-destructive 整理
		* button, and the JSON snapshot export/import seam). Every change commits
		* immediately through the scope (no staged form).
		*
		* Kept dependency-free beyond react: the scope is subscribed with
		* `useSyncExternalStore`, and the controls are plain HTML reusing the
		* stylesheet the client half injects.
		*/
		/** Row shared by every field of the card. */
		function Row(props) {
			return (0, react.createElement)("div", { className: "dsws_setRow" }, [(0, react.createElement)("div", {
				key: "text",
				className: "dsws_setText"
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dsws_setTitle"
			}, props.title), props.desc !== void 0 && (0, react.createElement)("span", {
				key: "d",
				className: "dsws_setDesc"
			}, props.desc)]), (0, react.createElement)("div", { key: "ctl" }, props.control)]);
		}
		/**
		* A boolean switch editing one namespace field.
		*
		* Drawn entirely with inline styles (thinking-levels discipline): the card
		* must not depend on the injected stylesheet — scoped or late-loaded settings
		* pages left the class-based switch rendering as a bare checkbox dot.
		*/
		function Toggle(props) {
			const checked = props.checked;
			return (0, react.createElement)("label", { style: {
				position: "relative",
				width: "40px",
				height: "22px",
				flex: "none",
				display: "inline-block",
				cursor: props.writable ? "pointer" : "not-allowed"
			} }, [
				(0, react.createElement)("input", {
					key: "input",
					type: "checkbox",
					checked,
					disabled: !props.writable,
					onChange: (e) => props.onChange(e.target.checked),
					style: {
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						opacity: 0,
						margin: 0,
						cursor: props.writable ? "pointer" : "not-allowed"
					}
				}),
				(0, react.createElement)("span", {
					key: "track",
					style: {
						position: "absolute",
						inset: 0,
						background: checked ? "var(--dsw-alias-state-business-primary, #4c6ef5)" : "var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.25))",
						border: `1px solid ${checked ? "var(--dsw-alias-state-business-primary, #4c6ef5)" : "var(--dsw-alias-border-l2, rgba(127,127,127,0.35))"}`,
						borderRadius: "11px",
						transition: "background .15s ease, border-color .15s ease",
						pointerEvents: "none"
					}
				}),
				(0, react.createElement)("span", {
					key: "thumb",
					style: {
						position: "absolute",
						top: "2px",
						left: "2px",
						width: "16px",
						height: "16px",
						background: "#fff",
						borderRadius: "50%",
						boxShadow: "0 1px 2px rgba(0,0,0,.2)",
						transition: "transform .15s ease",
						transform: checked ? "translateX(18px)" : "none",
						pointerEvents: "none"
					}
				})
			]);
		}
		/**
		* A status pill in the official ConnectionIndicator visual language: rounded
		* chip, semantic state tokens, animated dots while syncing.
		*/
		function StatusPill(props) {
			const stateClass = props.state === "ready" ? "dsws_pillReady" : props.state === "syncing" ? "dsws_pillWarn" : props.state === "error" ? "dsws_pillError" : "dsws_pillNeutral";
			return (0, react.createElement)("span", { className: `dsws_pill ${stateClass}` }, [(0, react.createElement)("span", {
				key: "icon",
				className: "dsws_pillIcon",
				"aria-hidden": true
			}, props.icon), (0, react.createElement)("span", {
				key: "label",
				className: "dsws_pillLabel"
			}, [(0, react.createElement)("span", { key: "text" }, props.label), props.dots === true && (0, react.createElement)("span", {
				key: "dots",
				className: "dsws_pillDots",
				"aria-hidden": true
			}, (0, react.createElement)("span", {}, "."), (0, react.createElement)("span", {}, "."), (0, react.createElement)("span", {}, "."))])]);
		}
		/** The independent-index lifecycle block (status + 整理 + snapshot seam). */
		function IndexBlock(props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [fetchError, setFetchError] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [note, setNote] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				let timer;
				const refresh = () => {
					callHostAny("index-status", {}).then((res) => {
						if (cancelled) return;
						if (res.ok) {
							setStatus(res);
							setFetchError(null);
						} else {
							setStatus(null);
							setFetchError(res.error ?? "index-status 请求失败");
						}
						if (res.rebuild?.state === "building" || res.rebuild?.state === "swapping") timer = window.setTimeout(refresh, 2e3);
						else setBusy(false);
					});
				};
				refresh();
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [attempt]);
			const t = props.t;
			const rebuilding = status?.rebuild?.state === "building" || status?.rebuild?.state === "swapping";
			const rebuildError = status?.rebuild?.state === "error" ? status.rebuild.error : void 0;
			const syncFailures = status?.sync?.failures?.length ?? 0;
			const blocking = busy || rebuilding;
			const onRebuild = () => {
				setBusy(true);
				setNote(null);
				callHostAny("index-rebuild", {}).then((res) => {
					if (!res.ok) {
						setNote(translate$1(t, "card.action.failed", { error: res.error ?? "?" }));
						setBusy(false);
					}
				});
			};
			const onExport = () => {
				setBusy(true);
				setNote(null);
				downloadSnapshot().then(() => setNote(translate$1(t, "card.index.exported"))).catch((err) => setNote(translate$1(t, "card.action.failed", { error: String(err instanceof Error ? err.message : err) }))).finally(() => setBusy(false));
			};
			const onImportFile = (file) => {
				setBusy(true);
				setNote(null);
				file.text().then((text) => callHostAny("index-import", text, 3e4)).then((res) => {
					if (res.ok) setNote(translate$1(t, "card.index.import.started"));
					else setNote(res.error ?? translate$1(t, "card.index.importParse"));
				}).catch((err) => setNote(translate$1(t, "card.action.failed", { error: String(err instanceof Error ? err.message : err) }))).finally(() => setBusy(false));
			};
			const pillState = rebuilding ? "syncing" : status?.rebuild?.state === "error" || fetchError !== null ? "error" : status === null || status.available !== true ? "neutral" : "ready";
			const pillLabel = fetchError !== null ? "状态读取失败" : rebuilding ? translate$1(t, "card.index.rebuilding", {
				done: status?.rebuild?.done ?? 0,
				total: status?.rebuild?.total || "?"
			}) : status === null ? translate$1(t, "card.index.reading") : status.available === true ? translate$1(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" }) : translate$1(t, "card.index.empty");
			const statusLine = fetchError !== null ? `索引状态读取失败：${fetchError}。请完全重启 dsh web（浏览器刷新不会重载 Host 半）后重试。` : status === null ? translate$1(t, "card.index.reading") : rebuilding ? translate$1(t, "card.index.rebuilding", {
				done: status.rebuild?.done ?? 0,
				total: status.rebuild?.total || "?"
			}) : status.available === true ? `${translate$1(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" })}${(status.archives?.length ?? 0) > 0 ? translate$1(t, "card.index.archives", { archives: status.archives?.length }) : ""}` : translate$1(t, "card.index.empty");
			const rebuildDone = status?.rebuild?.done ?? 0;
			const rebuildTotal = status?.rebuild?.total ?? 0;
			const progressPct = rebuilding && rebuildTotal > 0 ? Math.min(100, Math.round(rebuildDone / rebuildTotal * 100)) : void 0;
			const progressBlock = rebuilding ? (0, react.createElement)("div", {
				key: "progress",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "4px",
					margin: "2px 0 6px",
					width: "100%"
				}
			}, [(0, react.createElement)("div", {
				key: "bar",
				style: {
					height: "6px",
					borderRadius: "3px",
					background: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.2))",
					overflow: "hidden"
				}
			}, (0, react.createElement)("div", { style: progressPct === void 0 ? {
				height: "100%",
				width: "30%",
				borderRadius: "3px",
				background: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				opacity: .6
			} : {
				height: "100%",
				width: `${progressPct}%`,
				borderRadius: "3px",
				background: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				transition: "width .4s ease"
			} })), (0, react.createElement)("span", { style: {
				color: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				fontSize: "12px",
				lineHeight: "18px",
				fontWeight: 600,
				fontVariantNumeric: "tabular-nums"
			} }, progressPct === void 0 ? translate$1(t, "card.index.rebuilding", {
				done: rebuildDone,
				total: "?"
			}) : `${progressPct}% · ${translate$1(t, "card.index.rebuilding", {
				done: rebuildDone,
				total: rebuildTotal
			})}`)]) : null;
			return (0, react.createElement)("div", {
				className: "dsws_setRow",
				style: rebuilding ? {
					flexDirection: "column",
					alignItems: "stretch"
				} : void 0
			}, [
				(0, react.createElement)("div", {
					key: "text",
					className: "dsws_setText"
				}, [
					(0, react.createElement)("span", {
						key: "t",
						className: "dsws_setTitle"
					}, translate$1(t, "card.index")),
					(0, react.createElement)("span", {
						key: "p",
						style: {
							display: "flex",
							gap: "8px",
							alignItems: "center",
							flexWrap: "wrap"
						}
					}, [(0, react.createElement)(StatusPill, {
						key: "pill",
						state: pillState,
						label: pillLabel,
						icon: pillState === "ready" ? "✓" : pillState === "syncing" || pillState === "error" ? "!" : "·",
						dots: pillState === "syncing"
					}), (status?.archivedSessions ?? 0) > 0 && (0, react.createElement)("span", {
						key: "archived",
						className: "dsws_pill dsws_pillNeutral"
					}, translate$1(t, "panel.archived", { count: status?.archivedSessions ?? 0 }))]),
					(0, react.createElement)("span", {
						key: "d",
						className: "dsws_setDesc"
					}, statusLine),
					(status?.archivedSessions ?? 0) > 0 && (0, react.createElement)("span", {
						key: "archHint",
						className: "dsws_setDesc"
					}, status?.steward === "missing" ? translate$1(t, "card.index.archivedMissing") : translate$1(t, "card.index.archivedOwner")),
					rebuildError !== null && rebuildError !== void 0 && (0, react.createElement)("span", {
						key: "err",
						className: "dsws_setDesc"
					}, translate$1(t, "card.index.rebuildError", { error: rebuildError })),
					syncFailures > 0 && (0, react.createElement)("span", {
						key: "warn",
						className: "dsws_setDesc"
					}, translate$1(t, "card.index.failures", { count: syncFailures })),
					note !== null && (0, react.createElement)("span", {
						key: "note",
						className: "dsws_setDesc"
					}, note),
					(0, react.createElement)("span", {
						key: "hint",
						className: "dsws_setDesc"
					}, translate$1(t, "card.index.rebuild.hint"))
				]),
				progressBlock,
				(0, react.createElement)("div", {
					key: "btns",
					className: "dsws_btnRow"
				}, [
					(0, react.createElement)("button", {
						key: "rebuild",
						type: "button",
						className: "dsws_actBtn",
						disabled: blocking,
						onClick: onRebuild
					}, rebuilding ? translate$1(t, "card.index.rebuilding.btn") : translate$1(t, "card.index.rebuild")),
					(0, react.createElement)("button", {
						key: "export",
						type: "button",
						className: "dsws_actBtn",
						disabled: blocking || status?.available !== true,
						onClick: onExport
					}, translate$1(t, "card.index.export")),
					fetchError !== null && (0, react.createElement)("button", {
						key: "retryStatus",
						type: "button",
						className: "dsws_actBtn",
						onClick: () => {
							setAttempt((n) => n + 1);
						}
					}, "重试状态"),
					(0, react.createElement)("label", {
						key: "import",
						className: "dsws_actBtn"
					}, [translate$1(t, "card.index.import"), (0, react.createElement)("input", {
						key: "file",
						type: "file",
						accept: ".jsonl,.json,text/plain,application/json",
						style: { display: "none" },
						onChange: (e) => {
							const file = e.target.files?.[0] ?? void 0;
							e.target.value = "";
							if (file !== void 0 && file !== null) onImportFile(file);
						}
					})])
				])
			]);
		}
		/**
		* The settings card body: a collapsed drawer shell (title + description +
		* chevron, thinking-levels pattern) expanding into the namespace fields and
		* the index-lifecycle block.
		* @param props - locale seat (optional) and the bound namespace scope.
		*/
		function SearchSettingsCard(props) {
			const { scope } = props;
			const t = props.t;
			const [open, setOpen] = (0, react.useState)(true);
			const body = createCardBody({
				t,
				snapshot: (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot()),
				scope
			});
			return (0, react.createElement)("div", { style: {
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
				background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
				borderRadius: "12px",
				transition: "border-color 0.16s, background 0.16s"
			} }, [(0, react.createElement)("button", {
				key: "head",
				type: "button",
				"aria-expanded": open,
				style: {
					appearance: "none",
					width: "100%",
					font: "inherit",
					color: "inherit",
					textAlign: "left",
					cursor: "pointer",
					background: "none",
					border: 0,
					borderRadius: "12px",
					display: "flex",
					alignItems: "center",
					gap: "12px",
					padding: "14px 16px"
				},
				onClick: () => {
					setOpen((current) => !current);
				}
			}, [(0, react.createElement)("span", {
				key: "text",
				style: {
					flex: "1 1 0%",
					minWidth: 0
				}
			}, [(0, react.createElement)("div", {
				key: "title",
				style: {
					fontSize: "14px",
					fontWeight: 600,
					color: "var(--dsw-alias-label-primary)"
				}
			}, translate$1(t, "card.title")), (0, react.createElement)("div", {
				key: "desc",
				style: {
					color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
					fontSize: "13px",
					lineHeight: 1.5
				}
			}, translate$1(t, "card.description"))]), (0, react.createElement)("svg", {
				key: "chev",
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				style: {
					color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
					flex: "0 0 auto",
					transition: "transform 0.16s",
					transform: open ? "rotate(180deg)" : "none"
				}
			}, (0, react.createElement)("path", {
				d: "M4 6l4 4 4-4",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}))]), open && (0, react.createElement)("div", {
				key: "body",
				style: { padding: "12px 16px" }
			}, body)]);
		}
		/** The card's expandable content: namespace fields plus the index block. */
		function createCardBody(props) {
			const t = props.t;
			const snapshot = props.snapshot;
			const scope = props.scope;
			if (snapshot.status === "unavailable") return [(0, react.createElement)("div", {
				className: "dsws_setRow",
				key: "unavailable"
			}, (0, react.createElement)("span", { className: "dsws_setTitle" }, translate$1(t, "card.unavailable")))];
			const value = snapshot.value ?? {};
			const writable = snapshot.writable;
			const syncIntervalSeconds = Math.round((value.syncIntervalMs ?? 3e4) / 1e3);
			const archiveKeep = value.archiveKeep ?? 2;
			const children = [
				(0, react.createElement)(Row, {
					key: "enable",
					title: translate$1(t, "card.enabled"),
					desc: translate$1(t, "card.enabled.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.enabled ?? true,
						writable,
						onChange: (checked) => {
							scope.set("enabled", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "mode",
					title: translate$1(t, "card.defaultMode"),
					desc: translate$1(t, "card.defaultMode.desc"),
					control: (0, react.createElement)("div", {
						className: "dsws_seg",
						role: "group"
					}, ["title", "content"].map((mode) => (0, react.createElement)("button", {
						key: mode,
						type: "button",
						className: `dsws_segBtn${(value.defaultMode ?? "title") === mode ? " dsws_segBtnActive" : ""}`,
						"aria-pressed": (value.defaultMode ?? "title") === mode,
						disabled: !writable,
						onClick: () => {
							scope.set("defaultMode", mode);
						}
					}, mode === "title" ? translate$1(t, "card.mode.title") : translate$1(t, "card.mode.content"))))
				}),
				(0, react.createElement)(Row, {
					key: "autoSync",
					title: translate$1(t, "card.autoSync"),
					desc: translate$1(t, "card.autoSync.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.autoSync ?? true,
						writable,
						onChange: (checked) => {
							scope.set("autoSync", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "interval",
					title: translate$1(t, "card.syncInterval"),
					desc: translate$1(t, "card.syncInterval.desc"),
					control: (0, react.createElement)("input", {
						type: "number",
						min: 5,
						max: 3600,
						disabled: !writable,
						value: syncIntervalSeconds,
						style: {
							width: "72px",
							boxSizing: "border-box"
						},
						className: "dsws_search",
						onChange: (e) => {
							const seconds = Number(e.target.value);
							if (Number.isFinite(seconds) && seconds >= 5) scope.set("syncIntervalMs", Math.round(seconds * 1e3));
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "archiveKeep",
					title: translate$1(t, "card.archiveKeep"),
					desc: translate$1(t, "card.archiveKeep.desc"),
					control: (0, react.createElement)("input", {
						type: "number",
						min: 0,
						max: 20,
						disabled: !writable,
						value: archiveKeep,
						style: {
							width: "72px",
							boxSizing: "border-box"
						},
						className: "dsws_search",
						onChange: (e) => {
							const count = Number(e.target.value);
							if (Number.isFinite(count) && count >= 0) scope.set("archiveKeep", Math.round(count));
						}
					})
				})
			];
			const indexBlock = IndexBlock({ t });
			children.push(indexBlock);
			if (!writable) children.push((0, react.createElement)("div", {
				key: "ro",
				className: "dsws_setDesc"
			}, translate$1(t, "card.readonly")));
			return children;
		}
		//#endregion
		//#region src/client/index.ts
		/** 字典命名空间（locale.register 用）。 */
		const NS = "dsh-session-steward";
		/** 客户端插件声明的注入面。 */
		const inject = ["slots", "locale"];
		/** 注入样式（幂等）。 */
		function injectStyles() {
			const id = "dsh-session-steward-styles";
			if (typeof document === "undefined") return () => {};
			if (document.getElementById(id) !== null) return () => {};
			const style = document.createElement("style");
			style.id = id;
			style.textContent = `
/* 侧栏 footer 槽位公约（2026-09-26；2026-10-01 收紧行距并强制居中）：一行多
   入口（第三方 dsh-context 等）会互相挤占 —— 宿主 .footerActions 是 nowrap
   flex 行。这里允许容器换行，并把本插件入口钉成独占一整行（flex-basis:100%）；
   其余入口（含第三方）自然落到后续行，各行内部自行布局，谁也不挤谁。
   justify-content:center 让行内所有入口（含不占满行的）统一居中；row-gap:0
   配合入口自身 32px 高度压缩纵向占位。类名用 [class*=] 中段匹配：宿主是 CSS
   Module 哈希类名（实测形如 hHd-Xa_footerActions —— <hash>_<name>，哈希在前），
   中段跨版本稳定。 */
[class*="footerActions"]{flex-wrap:wrap;justify-content:center;row-gap:0;height:auto;min-height:0}
/* —— 第三方矫正：dsh-context「上下文洞察」入口（2026-10-01）——
   .lc-ov-entry 按"独占整行"设计（width:calc(100% + 4px)、无 justify-content、
   42px 高、不对称 padding），与本槽位公约（每个入口独占一行、行内居中、32px）
   冲突，表现为文字靠左、纵向松散。这里按公约强制矫正；:not() 排除收起轨道的
   36px 圆钮形态。lc-ov-* 是 dsh-context 源码硬编码类名（非构建哈希），跨版本
   稳定（实测 0.56.1 / 0.60.0 规则一致）。两个自有插件各自携带同一矫正块：
   任一被禁用时矫正仍生效。 */
.lc-ov-entry:not(.lc-ov-entry-rail){width:auto!important;flex:0 0 100%!important;min-width:0!important;justify-content:center!important;height:32px!important;margin:0!important;padding:0 10px!important}
.lc-ov-entry-label{flex:0 1 auto!important}
/* 宽栏：独占一整行、放弃主动收缩（flex-shrink:0），行内居中；收起轨道回落自然宽度。 */
.dss_entryWrap{flex:0 1 auto;display:inline-flex;align-items:center;min-width:0}
.dss_entryWrapWide{flex:0 0 100%;width:100%;justify-content:center;margin-left:0}
/* 高度 32px（内容 22px 行高 + 上下各 5px）：宿主默认 42px 的上下裕度在多行
   堆叠后过于松散；左右内边距对称（10px/10px），否则整行居中时按钮内容会因
   不对称 padding 向左偏 1px。 */
.dss_footerEntry{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:32px;padding:0 10px;border:none;border-radius:12px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dss_footerEntry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss_footerEntryRail{width:28px;height:28px;padding:0;gap:0;border-radius:50%}
.dss_footerIcon{flex:none;font-size:15px;line-height:1}
.dss_footerLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_backdrop{position:fixed;inset:0;background:rgba(15,20,30,.42);z-index:1000}
.dss_panel{position:fixed;z-index:1001;left:50%;top:6vh;transform:translateX(-50%);width:min(860px,94vw);max-height:86vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.18);padding:10px 14px 14px}
.dss_dialogHead{display:flex;align-items:center;gap:10px;min-height:34px}
.dss_dialogTitle{font-weight:600;color:var(--dsw-alias-label-primary,#111827);flex:1 1 auto;min-width:0}
.dss_tabRow{display:inline-flex;gap:4px}
.dss_tab{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_tabActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12));color:var(--dsw-alias-label-primary,#111827)}
.dss_tabBody{display:flex;flex-direction:column;gap:8px;padding-top:8px}
.dss_actBtn{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary,#111827)}
.dss_actBtn:disabled{opacity:.5;cursor:default}
.dss_dangerBtn{border-color:var(--dsw-alias-state-error-primary,#dc2626);color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_editActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12))}
.dss_btnRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dss_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.dss_row{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;border:1px solid transparent}
.dss_row:hover{border-color:var(--dsw-alias-border-l2,#e5e7eb)}
.dss_rowTitle{display:flex;gap:6px;align-items:center;flex:1 1 auto;min-width:0}
.dss_titleText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_tag{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_metaLine{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_uuid{font-family:var(--ds-font-family-code,monospace)}
/* 按行的磁盘占用：右对齐、不参与标题压缩，方便纵向比对「哪条最占地方」。 */
.dss_size{flex:none;font-variant-numeric:tabular-nums;white-space:nowrap}
.dss_check{display:inline-flex;align-items:center}
.dss_status{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_warnText{color:var(--dsw-alias-state-warning-primary,#d97706)}
.dss_error{font-size:12px;color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af);padding:10px 2px}
.dss_gateList{display:flex;flex-direction:column;gap:6px}
.dss_gate{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 10px}
.dss_gateName{font-weight:600;font-size:12px}
.dss_gateEvidence{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1 1 100%}
.dss_levelPill{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid transparent}
.dss_level_ok{background:rgba(22,163,74,.12);color:#15803d}
.dss_level_warn{background:rgba(217,119,6,.14);color:#b45309}
.dss_level_fail{background:rgba(220,38,38,.14);color:#b91c1c}
.dss_level_skipped{background:rgba(107,114,128,.14);color:#4b5563}
.dss_progressRow{display:flex;align-items:center;gap:8px;margin-top:2px}
.dss_progressTrack{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#eef0f3);overflow:hidden}
.dss_progressFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d5be0);transition:width .2s ease}
.dss_progressIndeterminate{width:35%;animation:dssSlide 1.1s ease-in-out infinite}
.dss_why{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1;min-width:0}
.dss_cacheRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.dss_spinner{width:11px;height:11px;margin-right:6px;border-radius:50%;display:inline-block;vertical-align:-1px;border:2px solid currentColor;border-top-color:transparent;animation:dssSpin .7s linear infinite}
@keyframes dssSpin{to{transform:rotate(360deg)}}
@keyframes dssSlide{0%{margin-left:-35%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){.dss_spinner{animation:none}.dss_progressIndeterminate{animation:none;width:100%;opacity:.5}.dss_setChev{transition:none}.dss_setCard{transition:none}}
.dss_verdict{font-size:12px;line-height:18px;border-radius:8px;padding:6px 10px;margin-top:6px;border:1px solid transparent}
.dss_verdict_repaired{background:rgba(22,163,74,.10);color:#15803d;border-color:rgba(22,163,74,.28)}
.dss_verdict_repaired-with-residual{background:rgba(217,119,6,.10);color:#b45309;border-color:rgba(217,119,6,.28)}
.dss_verdict_nothing-to-do{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_not-applicable{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_failed{background:rgba(220,38,38,.10);color:#b91c1c;border-color:rgba(220,38,38,.28)}
.dss_phaseRow{display:flex;gap:8px;align-items:center}
.dss_phase{font-weight:600;font-size:12px}
.dss_cmdBlock{display:flex;flex-direction:column;gap:4px;border:1px dashed var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 8px}
.dss_cmdLine{display:flex;gap:6px;align-items:center}
.dss_cmd{flex:1 1 auto;font-family:var(--ds-font-family-code,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all}
.dss_setCard{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));border-radius:12px;transition:border-color .16s,background .16s}
.dss_setHead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:none;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}
.dss_setHeadText{display:flex;flex-direction:column;gap:2px;flex:1 1 0%;min-width:0}
.dss_setCardTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#111827)}
.dss_setCardDesc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_setChev{color:var(--dsw-alias-label-tertiary,#9ca3af);flex:0 0 auto;transition:transform .16s}
.dss_setCardOpen .dss_setChev{transform:rotate(180deg)}
.dss_setBody{display:flex;flex-direction:column;gap:2px;padding:0 16px 12px}
.dss_setRow{display:flex;align-items:center;gap:10px;padding:6px 0}
.dss_setText{display:flex;flex-direction:column;flex:1 1 auto;min-width:0}
.dss_setTitle{font-size:13px;color:var(--dsw-alias-label-primary,#111827)}
.dss_setDesc{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_toggle{display:inline-flex;align-items:center;cursor:pointer;position:relative}
.dss_toggle input{position:absolute;opacity:0;width:0;height:0}
.dss_toggleTrack{width:34px;height:18px;border-radius:999px;background:var(--dsw-alias-border-l2,#d1d5db);position:relative;transition:background .15s ease}
.dss_toggleKnob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s ease}
.dss_toggleOn .dss_toggleTrack{background:var(--dsw-alias-button-primary-fill,#3f63d8)}
.dss_toggleOn .dss_toggleKnob{left:18px}
`;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		/**
		* 客户端插件主体。
		* @param ctx - 客户端上下文（slots、可选 locale / configForms）。
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-session-steward: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") {
				ctx.effect(() => locale.register(NS, dictionaries$1), "dsh-session-steward: dictionaries");
				ctx.effect(() => locale.register(NS$1, dictionaries), "dsh-session-steward: search dictionaries");
			}
			ctx.effect(() => injectStyles$1(), "dsh-session-steward: search stylesheet");
			const configForms = ctx.get("configForms");
			const legacySettings = ctx.get("settingsScope");
			const bound = configForms?.get("dsh-session-steward") ?? legacySettings?.bind({ namespace: "session-steward" });
			const searchBound = configForms?.get("dsh-session-steward") ?? legacySettings?.bind({ namespace: "switch-search" });
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const openSearchHit = (sessionId) => {
				openSessionThrough((name) => ctx.get(name), sessionId);
			};
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: "dsh-search-index",
				order: 5
			}, (props) => (0, react.createElement)(SearchEntry, {
				...props,
				open: openSearchHit,
				scope: searchBound
			})), "dsh-session-steward: sidebar footer search entry");
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: STEWARD_ENTRY_ID,
				order: 6
			}, (props) => (0, react.createElement)(StewardEntry, {
				...props,
				scope: bound,
				openSession: openSearchHit
			})), "dsh-session-steward: sidebar footer entry");
			slots.inject("dsh-family.tab", () => slots.register({
				name: "dsh-family.tab",
				id: "dsh-search-index",
				order: 30,
				label: () => translate$1(locale?.bind?.(NS$1), "card.title"),
				locale: NS$1
			}, (props) => (0, react.createElement)(SearchSettingsCard, {
				scope: searchBound,
				t: props.t
			})), "dsh-session-steward: family settings tab (search)");
			slots.inject("dsh-family.tab", () => slots.register({
				name: "dsh-family.tab",
				id: STEWARD_ENTRY_ID,
				order: 40,
				label: () => translate(locale?.bind?.(NS), "card.title"),
				locale: NS
			}, (props) => (0, react.createElement)(StewardSettingsCard, {
				scope: bound,
				t: props.t
			})), "dsh-session-steward: family settings tab");
			slots.inject("plugins.bundle.config", () => slots.register({
				name: "plugins.bundle.config",
				key: STEWARD_ENTRY_ID
			}, (props) => (0, react.createElement)("div", { style: {
				display: "grid",
				gap: "12px"
			} }, [(0, react.createElement)(SearchSettingsCard, {
				scope: searchBound,
				t: props.t
			}), (0, react.createElement)(StewardSettingsCard, {
				scope: bound,
				t: props.t
			})])), "dsh-session-steward: plugins page config card");
			const familyTabsHooks = makeFamilyTabsHooks(slots);
			ctx.effect(() => {
				let claimed;
				const timer = setTimeout(() => {
					if (slots.entries("settings.section").some((e) => e.options.id === FAMILY_SECTION_ID)) return;
					try {
						claimed = slots.register({
							name: "settings.section",
							id: FAMILY_SECTION_ID,
							order: 40,
							label: () => translate(locale?.bind?.(NS), "family.title"),
							locale: NS,
							inject: () => ({ hooks: { tabs: familyTabsHooks } }),
							children: { [FAMILY_CHILD_KEY]: {
								kind: "list",
								scope: "root"
							} }
						}, StewardFamilySection);
					} catch {}
				}, FAMILY_HOST_GRACE_MS);
				return () => {
					clearTimeout(timer);
					if (typeof claimed === "function") claimed();
				};
			}, "dsh-session-steward: family fallback host");
		}
		/** 家族节固定 id（与 thinking-levels / guard 的注册严格一致）。 */
		const FAMILY_SECTION_ID = "dsh-family";
		/** 家族子席位 key（与 thinking-levels 的声明严格一致）。 */
		const FAMILY_CHILD_KEY = "dsh-family.tab";
		/** 接管宽限期：guard 2000ms 先试，本插件 2600ms 兜底。 */
		const FAMILY_HOST_GRACE_MS = 2600;
		/** 接管节的账本投影 hooks（与 thinking-levels 的 FamilySectionInjected 同形；locale 变更也触发重渲染）。 */
		function makeFamilyTabsHooks(slots) {
			let version = -1;
			let tabs = [];
			return {
				getSnapshot: () => {
					const next = slots.getVersion(FAMILY_CHILD_KEY);
					if (next !== version) {
						version = next;
						tabs = slots.entries(FAMILY_CHILD_KEY).map((entry) => ({
							id: entry.options.id ?? "",
							order: entry.options.order ?? 0,
							label: typeof entry.options.label === "function" ? (() => {
								try {
									return String(entry.options.label() ?? entry.options.id ?? "");
								} catch {
									return String(entry.options.id ?? "");
								}
							})() : String(entry.options.label ?? entry.options.id ?? "")
						})).sort((a, b) => a.order - b.order);
					}
					return tabs;
				},
				subscribe: (listener) => slots.subscribe(FAMILY_CHILD_KEY, listener)
			};
		}
		/**
		* 家族节接管组件（fallback host section）：纯通用渲染 —— 把 `dsh-family.tab`
		* 账本里的每张贡献卡（含本插件自己的，接管时本插件也声明了该子席位）按
		* order 依次 renderSlot；各卡本身是默认展开的抽屉，整节即一页抽屉。
		*/
		function StewardFamilySection(props) {
			const tabs = (0, react.useSyncExternalStore)(props.hooks.tabs.subscribe, props.hooks.tabs.getSnapshot);
			return (0, react.createElement)("div", { style: {
				display: "grid",
				gap: "12px"
			} }, ...tabs.map((row) => (0, react.createElement)("div", { key: row.id }, props.renderSlot(FAMILY_CHILD_KEY, {}, {
				only: row.id,
				fallback: null
			}))));
		}
		/** 入口按钮：持有面板开关；两个页签的可见性来自配置快照。 */
		function StewardEntry(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const snapshot = (0, react.useSyncExternalStore)((listener) => props.scope !== void 0 ? props.scope.subscribe(listener) : () => {}, () => props.scope !== void 0 ? props.scope.getSnapshot() : { value: DEFAULT_CONFIG });
			const config = {
				...DEFAULT_CONFIG,
				...snapshot.value ?? {}
			};
			const historyFiles = config.historyFiles !== false;
			const healthCheck = config.healthCheck !== false;
			const searchEnabled = config.search !== false;
			const visible = config.enabled !== false && (historyFiles || healthCheck || searchEnabled);
			const wide = props.wide === true;
			const label = translate(void 0, "panel.title");
			if (!visible) return (0, react.createElement)("span", { className: "dss_entryWrap" });
			return (0, react.createElement)("span", { className: wide ? "dss_entryWrap dss_entryWrapWide" : "dss_entryWrap" }, [(0, react.createElement)(StewardFooter, {
				key: "btn",
				title: label,
				label,
				wide,
				onClick: () => {
					setOpen(!open);
				}
			}), open ? (0, react.createElement)(StewardPanel, {
				key: "panel",
				historyFiles,
				healthCheck,
				searchEnabled,
				openSession: props.openSession,
				onClose: () => {
					setOpen(false);
				}
			}) : null]);
		}
		/**
		* 搜索侧栏入口（合并包装配）：双门可见性 —— 插件总开关 `enabled` 与搜索子域
		* 开关 `search` 任一关闭即不渲染；可见时交给 SwitchFooter（其内部再读一次
		* scope 的 enabled，与设置卡「启用会话搜索」同源，开关不会空转）。
		*/
		function SearchEntry(props) {
			const scope = props.scope;
			const value = (0, react.useSyncExternalStore)((listener) => scope?.subscribe(listener) ?? (() => {}), () => scope?.getSnapshot())?.value ?? {};
			if (value["enabled"] === false || value["search"] === false) return (0, react.createElement)("span", { className: "dss_entryWrap" });
			return (0, react.createElement)("span", { className: props.wide === true ? "dss_entryWrap dss_entryWrapWide" : "dss_entryWrap" }, (0, react.createElement)(SwitchFooter, {
				wide: props.wide === true,
				open: props.open,
				scope: props.scope
			}));
		}
		//#endregion
		exports.NS = NS;
		exports.STEWARD_ENTRY_ID = STEWARD_ENTRY_ID;
		exports.STEWARD_SETTINGS_NAMESPACE = STEWARD_SETTINGS_NAMESPACE;
		exports.StewardEntry = StewardEntry;
		exports.TAB_HEALTH = TAB_HEALTH;
		exports.TAB_HISTORY = TAB_HISTORY;
		exports.apply = apply;
		exports.inject = inject;
		exports.translate = translate;
		return module.exports;
	}
});

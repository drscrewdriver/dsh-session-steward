# dsh-session-steward (세션 스튜어드)

**세션 히스토리 파일**과 **세션 상태 점검**을 위한 DSH 웹 플러그인입니다. 세션 데이터 자체는 건드리지 않습니다.

- **기록 보관소(히스토리 파일)** — 공식 아카이브 집합을 조회하고 id를 일괄 정리합니다
  (백업 + 원자적 교체, 호스트가 다시 로드하려면 DSH 재시작이 필요합니다).
- **점검(상태)** — 네 개의 gate → 처방(명령 목록) → 퇴원(전후 비교가 포함된 되돌릴 수 있는 복구).

> 이름 경계: **이 패키지는 검색이나 인덱스 기능을 제공하지 않습니다**. 검색/인덱싱은
> `dsh-search-index`에 속하며, 어느 쪽도 상대방의 필드를 언급하거나 재해석하지 않습니다.

## 스크린샷

사이드바 하단에 **「会话管家」**(세션 스튜어드) 항목이 추가되어 검색, 설정과 나란히 표시됩니다:

![사이드바 항목](assets/left-sidebar.png)

**기록 보관소(히스토리 파일)** — 공식 아카이브 집합 목록. 각 행에 용량과 디스크 실체 존재 여부를 표시하며, 선택하여 아카이브 해제 또는 정리를 할 수 있습니다:

![기록 보관소](assets/archive.png)

**점검** — 네 개의 gate 점검 입구이며, 검사 후 되돌릴 수 있는 처방을 제시합니다:

![점검](assets/doctor.png)

## 설치

```bash
dsh plugin --profile web add dsh-session-steward
```

이후 호스트 프로세스를 재시작하세요(페이지 새로고침만으로는 부족합니다).

## 라우트

접두사 `/session-steward/api`; 모든 메서드 이름은 `session-*`이며(`index-*`는 결코 아닙니다), 인식되지 않는
메서드는 조용히 실패하지 않고 명시적인 오류를 반환합니다.

| 메서드 | 도메인 | 목적 |
|---|---|---|
| `session-history-list` | history | 공식 아카이브 집합 조회(출처 및 성능 저하 관련 주석 포함) |
| `session-history-prune` | history | 아카이브 배열에서 id 일괄 제거(자동 백업, 재시작 필요) |
| `session-health-status` | health | 스위치 상태와 메서드 표(패널 폴링) |
| `session-health-scan` | health | 일괄 점검(기본값은 비정상 세션만) |
| `session-health-session` | health | 단일 세션의 4-gate 리포트와 처방 |
| `session-health-repair` | health | 되돌릴 수 있는 복구(프로젝션 캐시 레코드 격리)와 전후 비교 |

설정 네임스페이스 `session-steward`; 사이드바 항목 id `dsh-session-steward`.

## 스위치(기능 게이트)

| 스위치 | 필드 | 꺼져 있을 때 |
|---|---|---|
| 세션 히스토리 파일 | `historyFiles`(기본값 true) | `session-history-*`가 등록되지 않고 기록 보관소 탭이 렌더링되지 않습니다 |
| 상태 점검 | `healthCheck`(기본값 true) | `session-health-*`가 등록되지 않고 점검 탭이 렌더링되지 않습니다 |

닫힌 도메인은 `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }`를 반환합니다 — 빈 껍데기는 남지 않습니다.

## `dsh-search-index`와의 계약

아카이브 파일 형식(`~/.dsh/storages/workspace.json`의 `global.archivedSessionIds`):
**이 플러그인이 쓰고, search-index 플러그인은 읽기만 합니다**. `dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`를 참고하세요.

## 개발

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## 라이선스

MIT

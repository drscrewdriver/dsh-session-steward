# 설치 가이드(공식 DSH CLI)

이 가이드는 공식 DSH `dsh plugin` 명령만 사용합니다. 이 명령은 의존성을 프로필에 설치하고 `dsh.profile.bundles`를 동기화합니다. 이를 일반 `npm install`, 프로필에서의 직접적인 `pnpm add`, 또는 프로필 매니페스트의 수동 편집으로 대체하지 마세요.

- [영어 설치 가이드](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [中文 README](./README.md)
- [영어 README](./README.en.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [변경 이력](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

이 가이드의 자리표시자는 다음과 같습니다.

- `<profile>`: 수정할 DSH 프로필이며, 보통 `web`입니다;
- `dsh-session-steward`: npm 패키지이자 런타임 플러그인 ID입니다.

> **지원 DSH 범위: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> 이는 `package.json`과 `dsh.plugin.json` 양쪽의 `engines.dsh`에 선언된 범위이며, 이 플러그인이 자체 `@deepseek-ai/dsh-client-ui-slots` 의존성에 대해 이미 선언한 `^0.1.0-rc.6` 하한과 일치합니다. 설치 전에 `dsh --version`으로 실행 중인 버전을 확인하세요.

## 0. 사전 요구 사항과 프로필 확인

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

실행 중인 DSH 프로세스가 지정한 프로필을 사용하세요. `web`이 일반적이지만, 활성 `--profile` 인자가 기준입니다.

## 1. 공식 설치

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(프로필이 `web`처럼 pnpm 워크스페이스 루트인 경우 `-w` 플래그가 필요합니다.)

특정 버전을 명시적으로 설치:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.2 -w
```

공식 CLI는 프로필 의존성, 잠금 파일, `dsh.profile.bundles`를 자동으로 갱신합니다. YAML 행을 수동으로 추가하지 마세요.

### 공급망 쿨다운 기간

DSH 런타임은 pnpm 11을 사용하며, 그 `minimumReleaseAge` 정책이 갓 게시된 버전을 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`과 함께 차단할 수 있습니다. `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 해당 버전을 추가하세요:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.2
```

## 2. 호스트 재시작

**설치 또는 업그레이드 후에는 DSH 재시작이 필요합니다.** 브라우저 페이지 새로고침만으로는 부족합니다: 호스트 측은 시작 시 `/session-steward/api` 라우트와 설정 네임스페이스를 등록하며, 정리 결과를 반영하려면 호스트가 아카이브 소스를 다시 로드해야 합니다.

## 3. 업그레이드

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

이후 DSH를 재시작하세요.

## 4. 로컬 경로 / `link:` 등록(대안)

개발이나 오프라인 설치의 경우 로컬 체크아웃에서 플러그인을 등록합니다:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

또는 로컬 경로와 함께 공식 CLI를 사용하세요(네트워크 불필요):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

소스 체크아웃에서 빌드할 때는 다음 스크립트를 사용합니다:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/`는 커밋되지 않으므로, 소스 체크아웃은 경로로 등록하기 전에 빌드해야 합니다. 게시 시에는 `prepublishOnly` 훅을 통해 자동으로 빌드됩니다.

## 5. 설치 검증

의존성과 설치된 버전을 확인합니다:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

공식 구성을 확인합니다:

```bash
dsh --profile <profile> --dump-default-config
```

다음이 포함되어야 합니다:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. 플러그인 검증

재시작 후 사이드바 항목 `dsh-session-steward`를 사용할 수 있고, 설정 섹션은 `session-steward` 네임스페이스를 사용합니다. 다음을 확인하세요:

1. 두 기능 게이트가 모두 켜져 있을 때 **기록 보관소**와 **점검** 두 탭이 모두 렌더링됩니다.
2. `historyFiles`를 끄면 기록 보관소 탭이 사라지고 모든 `session-history-*` 호출이 명시적인 disabled 오류를 반환합니다.
3. `healthCheck`를 끄면 점검 탭이 사라지고 모든 `session-health-*` 호출이 명시적인 disabled 오류를 반환합니다.
4. `/session-steward/api`의 인식되지 않는 메서드는 조용히 성공하지 않고 명시적인 오류를 반환합니다.

닫힌 도메인은 `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }`를 반환합니다 — 플러그인은 빈 껍데기를 남기지 않습니다.

## 7. 문제 해결

| 증상 | 조치 |
| --- | --- |
| `dsh`를 찾을 수 없음 | 공식 DSH CLI를 설치하거나 활성화하세요. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 프로필의 `pnpm-workspace.yaml`에 있는 `minimumReleaseAgeExclude`에 해당 버전을 추가하세요. |
| 설치 후 탭이나 라우트가 없음 | 호스트 프로세스를 재시작하세요 — 페이지 새로고침은 라우트를 다시 등록하지 않습니다. |
| 아카이브 집합 변경 사항이 보이지 않음 | 호스트를 재시작하세요; 아카이브 소스는 시작 시 읽힙니다. |
| `session-history-*`가 disabled 오류를 반환함 | `historyFiles` 게이트가 꺼져 있습니다. 플러그인 설정에서 다시 켜세요. |
| `session-health-*`가 disabled 오류를 반환함 | `healthCheck` 게이트가 꺼져 있습니다. 플러그인 설정에서 다시 켜세요. |
| 업그레이드 후 클라이언트 번들이 오래됨 | 브라우저를 강력 새로고침하세요(Ctrl+Shift+R). |

## 8. 제거

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

이후 DSH를 재시작하세요.

## 제거해도 복구가 되돌려지지는 않습니다

이 플러그인은 세션 로그나 히스토리 데이터를 재작성하지 않으며, 필드를 조용히 버리지도 않습니다. 되돌릴 수 없어 보이는 유일한 동작 — 손상된 프로젝션 캐시 레코드 격리 — 은 먼저 백업을 복사하며, 격리 디렉터리는 복원에 사용할 수 있도록 디스크에 남겨 둡니다. 따라서 플러그인을 제거해도 요청한 격리 결과는 그대로 남습니다; 상태를 되돌리려면 직접 복원하세요.

## 라이선스

MIT

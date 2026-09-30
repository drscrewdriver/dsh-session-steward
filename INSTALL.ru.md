# Руководство по установке (официальный DSH CLI)

В этом руководстве используется только официальная команда DSH `dsh plugin`. Она устанавливает зависимость в профиль и синхронизирует `dsh.profile.bundles`. Не заменяйте её голым `npm install`, прямым `pnpm add` в профиле или ручными правками манифеста профиля.

- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Guide d'installation en français](./INSTALL.fr.md)
- [Installationsanleitung auf Deutsch](./INSTALL.de.md)
- [Guida all'installazione in italiano](./INSTALL.it.md)
- [Руководство по установке на русском](./INSTALL.ru.md)
- [Guía de instalación en español](./INSTALL.es.md)
- [中文 README](./README.md)
- [English README](./README.en.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Français README](./README.fr.md)
- [Deutsch README](./README.de.md)
- [Italiano README](./README.it.md)
- [Русский README](./README.ru.md)
- [Español README](./README.es.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

Заполнители в этом руководстве:

- `<profile>`: изменяемый профиль DSH, обычно `web`;
- `dsh-session-steward`: npm-пакет и идентификатор плагина во время выполнения.

> **Поддерживаемый диапазон DSH: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> Это диапазон, объявленный в `engines.dsh` как `package.json`, так и `dsh.plugin.json`, и он совпадает с нижней границей `^0.1.0-rc.6`, которую этот плагин уже объявляет для собственной зависимости `@deepseek-ai/dsh-client-ui-slots`. Перед установкой проверьте запущенную версию командой `dsh --version`.

## 0. Предпосылки и поиск профиля

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Используйте профиль, названный вашим запущенным процессом DSH. `web` — распространённый вариант, но решающим является активный аргумент `--profile`.

## 1. Официальная установка

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(флаг `-w` обязателен, когда профиль является корнем pnpm-workspace, как у `web`.)

Установка конкретной версии явно:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.6 -w
```

Официальный CLI автоматически обновляет зависимость профиля, lockfile и `dsh.profile.bundles`. Не добавляйте строку YAML вручную.

### Период охлаждения цепочки поставок

Среда выполнения DSH использует pnpm 11, чья политика `minimumReleaseAge` может заблокировать только что опубликованную версию с ошибкой `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Добавьте версию в `minimumReleaseAgeExclude` в `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.6
```

## 2. Перезапуск хоста

**После установки или обновления требуется перезапуск DSH.** Обновление страницы браузера недостаточно: хостовая половина регистрирует маршруты `/session-steward/api` и пространство имён настроек при запуске, и хост должен перечитать источник архивов, чтобы prune стал виден.

## 3. Обновление

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

После этого перезапустите DSH.

## 4. Регистрация по локальному пути / `link:` (альтернатива)

Для разработки или офлайн-установки зарегистрируйте плагин из локального чекаута:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Либо используйте официальный CLI с локальным путём (сеть не нужна):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

Сборка из чекаута исходников использует эти скрипты:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` не коммитится, поэтому чекаут исходников нужно собрать, прежде чем регистрировать его по пути. Публикация собирает его автоматически через хук `prepublishOnly`.

## 5. Проверка установки

Проверьте зависимость и установленную версию:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Проверьте официальную композицию:

```bash
dsh --profile <profile> --dump-default-config
```

Она должна содержать:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Проверка плагина

После перезапуска пункт боковой панели `dsh-session-steward` доступен, а раздел настроек использует пространство имён `session-steward`. Убедитесь:

1. Обе вкладки рендерятся — **Дом престарелых** и **Диспансеризация** — пока оба feature gate включены.
2. Выключение `historyFiles` убирает вкладку «Дом престарелых», и каждый вызов `session-history-*` возвращает явную ошибку отключения.
3. Выключение `healthCheck` убирает вкладку «Диспансеризация», и каждый вызов `session-health-*` возвращает явную ошибку отключения.
4. Нераспознанный метод на `/session-steward/api` возвращает явную ошибку, а не «успех» молча.

Отключённые домены возвращают `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — пустых оболочек плагин не оставляет.

## 7. Поиск и устранение неисправностей

| Симптом | Действие |
| --- | --- |
| `dsh` не найден | Установите или включите официальный DSH CLI. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Добавьте версию в `minimumReleaseAgeExclude` в `pnpm-workspace.yaml` профиля. |
| После установки нет вкладок или маршрутов | Перезапустите процесс-хост — обновление страницы не перерегистрирует маршруты. |
| Изменения набора архивов не видны | Перезапустите хост; источник архивов читается при запуске. |
| `session-history-*` возвращает ошибку отключения | Feature gate `historyFiles` выключен. Включите его снова в настройках плагина. |
| `session-health-*` возвращает ошибку отключения | Feature gate `healthCheck` выключен. Включите его снова в настройках плагина. |
| Устаревший клиентский bundle после обновления | Жёсткое обновление браузера (Ctrl+Shift+R). |

## 8. Удаление

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

После этого перезапустите DSH.

## Удаление не отменяет выполненные ремонты

Плагин никогда не переписывает журналы сессий и исторические данные и никогда не отбрасывает поля молча. Единственное внешне необратимое действие, которое он совершает, — карантин повреждённой записи кэша проекций — сперва копирует резервную копию, а каталог карантина остаётся на диске, чтобы вы могли из него восстановиться. Удаление плагина оставляет любой созданный вами карантин на месте; восстановите его вручную, если хотите вернуть состояние.

## Лицензия

MIT

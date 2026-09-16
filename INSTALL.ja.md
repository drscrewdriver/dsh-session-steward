# インストールガイド（公式 DSH CLI）

本ガイドは公式 DSH の `dsh plugin` コマンドのみを使用します。このコマンドは依存関係を profile にインストールし、`dsh.profile.bundles` を同期します。素の `npm install`、profile 内での直接の `pnpm add`、profile マニフェストの手動編集で置き換えないでください。

- [英語インストールガイド](./INSTALL.md)
- [中国語インストールガイド](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [韓国語インストールガイド](./INSTALL.ko.md)
- [中国語 README](./README.md)
- [英語 README](./README.en.md)
- [日本語 README](./README.ja.md)
- [韓国語 README](./README.ko.md)
- [変更履歴](./CHANGELOG.md)
- [日本語の変更履歴](./CHANGELOG.ja.md)
- [韓国語の変更履歴](./CHANGELOG.ko.md)

本ガイドで使用するプレースホルダは次のとおりです：

- `<profile>`：変更対象の DSH profile。通常は `web`。
- `dsh-session-steward`：npm パッケージ名かつランタイムプラグイン ID。

> **対応 DSH 範囲：`>=0.1.0-rc.6 <0.2.0-0`。**
>
> これは `package.json` と `dsh.plugin.json` の双方の `engines.dsh` で宣言されている範囲であり、本プラグインが自身の `@deepseek-ai/dsh-client-ui-slots` 依存に対してすでに宣言している `^0.1.0-rc.6` の下限とも一致します。インストール前に `dsh --version` で実行中のバージョンを確認してください。

## 0. 前提条件と profile の確認

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

実行中の DSH プロセスが指定している profile を使用してください。`web` が一般的ですが、実際に有効なのは `--profile` 引数です。

## 1. 公式インストール

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

（profile が `web` のように pnpm ワークスペースのルートである場合、`-w` フラグが必要です。）

特定のバージョンを明示的にインストールする場合：

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.4 -w
```

公式 CLI は profile の依存関係、ロックファイル、`dsh.profile.bundles` を自動的に更新します。YAML の行を手動で追加しないでください。

### サプライチェーンのクーリング期間

DSH ランタイムは pnpm 11 を使用しており、その `minimumReleaseAge` ポリシーが公開直後のバージョンを `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` でブロックすることがあります。`~/.dsh/profiles/<profile>/pnpm-workspace.yaml` の `minimumReleaseAgeExclude` にそのバージョンを追加してください：

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.4
```

## 2. ホストの再起動

**インストールまたはアップグレードの後には DSH の再起動が必要です。** ブラウザのページを再読み込みするだけでは不十分です。ホスト側は起動時に `/session-steward/api` ルートと設定名前空間を登録し、またアーカイブの取得元を再読み込みしない限り整理（prune）の結果は反映されません。

## 3. アップグレード

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

その後 DSH を再起動してください。

## 4. ローカルパス / `link:` による登録（代替手段）

開発やオフラインインストールでは、ローカルのチェックアウトからプラグインを登録します：

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

または、ローカルパスを指定して公式 CLI を使います（ネットワーク不要）：

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

ソースチェックアウトからビルドする場合は次のスクリプトを使います：

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` はコミットされていないため、ソースチェックアウトはパス指定で登録する前にビルドする必要があります。公開時は `prepublishOnly` フックによって自動的にビルドされます。

## 5. インストールの確認

依存関係とインストール済みバージョンを確認します：

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

公式のコンポジションを確認します：

```bash
dsh --profile <profile> --dump-default-config
```

次の内容が含まれている必要があります：

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. プラグインの確認

再起動後、サイドバーエントリ `dsh-session-steward` が利用可能になり、設定セクションは `session-steward` 名前空間を使用します。次を確認してください：

1. 両方のフィーチャーゲートがオンのとき、**カルテ室**と**健診**の両タブが描画される。
2. `historyFiles` をオフにするとカルテ室タブが消え、すべての `session-history-*` 呼び出しが明示的な disabled エラーを返す。
3. `healthCheck` をオフにすると健診タブが消え、すべての `session-health-*` 呼び出しが明示的な disabled エラーを返す。
4. `/session-steward/api` 上の未知のメソッドは、黙って成功せず明示的なエラーを返す。

閉じられたドメインは `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` を返します — プラグインは空の殻を後に残しません。

## 7. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `dsh` が見つからない | 公式 DSH CLI をインストールするか有効化してください。 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | profile の `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` にそのバージョンを追加してください。 |
| インストール後にタブやルートが表示されない | ホストプロセスを再起動してください — ページの再読み込みではルートは再登録されません。 |
| アーカイブ集合への変更が反映されない | ホストを再起動してください。アーカイブの取得元は起動時に読み込まれます。 |
| `session-history-*` が disabled エラーを返す | `historyFiles` ゲートがオフです。プラグイン設定で再度有効にしてください。 |
| `session-health-*` が disabled エラーを返す | `healthCheck` ゲートがオフです。プラグイン設定で再度有効にしてください。 |
| アップグレード後にクライアントバンドルが古い | ブラウザをスーパーリロードしてください（Ctrl+Shift+R）。 |

## 8. 削除

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

その後 DSH を再起動してください。

## 削除しても修復は元に戻らない

本プラグインはセッションログや履歴データを書き換えることも、フィールドを暗黙に破棄することもありません。一見不可逆に見える唯一の操作 — 破損したプロジェクションキャッシュのレコードを隔離する — も、先にバックアップをコピーし、隔離ディレクトリは復元できるようにディスク上に残します。したがって、プラグインを削除しても、あなたが実行した隔離はそのまま残ります。状態を元に戻したい場合は手動で復元してください。

## ライセンス

MIT

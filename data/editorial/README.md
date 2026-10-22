# ChatGPT日次ニュース編集版 — ファイル仕様

配信時刻は日本時間08:00。既存のRSS収集 `data/days/` は変更しない。
ChatGPTの日次ニュース・全分野ヘッドラインの内容を、このフォルダに **1日1ファイル** で保存する。
`YYYY-MM-DD.json` のYYYY-MM-DDは実行日（日本時間）。GitHub Pagesから直接取得する公開データ。
既に当日のファイルが存在する場合はGitHubの現行SHAを取得したうえで更新すること。毎日のファイルのみ更新し、過去分を消さない。

## JSONスキーマ（schema_version: 1）

```json
{
  "schema_version": 1,
  "edition_date": "2026-10-22",
  "generated_at": "2026-10-22T08:10:00+09:00",
  "window_start": "2026-10-21T08:00:00+09:00",
  "window_end": "2026-10-22T08:00:00+09:00",
  "lead": "新しいニュースの全体像を説明する100〜300字程度の日本語の概況。",
  "sections": [
    {
      "id": "politics",
      "name": "国内政治・法改正・行政",
      "importance": 5,
      "items": [
        {
          "id": "politics-001",
          "title": "内容の分かる具体的な見出し",
          "summary": "一次資料や複数報道に基づく一文の要旨。",
          "importance": 5,
          "event_date": "2026-10-22",
          "context": "背景。未調査なら空文字。",
          "impact": "経済社会への影響。推測は推測と明示。",
          "sources": [
            {"name": "公的機関・媒体名", "url": "https://example.org/example"}
          ]
        }
      ]
    }
  ],
  "warnings": []
}
```

- `importance` は、ニュース・分野とも1〜5の整数。件数上限は設けない。重要度は政治的賛否でなく社会的影響・構造変化・新規性を判断。
- `id` はファイル内でユニーク。記事の重複を避け、可能なら `section-001` 型を使う。
- `source.url` は実在する確認済みhttps/http URLのみ。創作したリンク、検索結果の曖昧なURLは載せない。
- 省略可能な `context` と `impact` は、推測で埋めない。 `summary` に元記事全文を転載しない。
- `warnings` は収集できなかった分野、確認できなかった情報等を記す。
- ユーザー固有の情報や個人的な会話内容を含めない。このリポジトリはPublic。
- 成功したGitHubへの保存はコミットSHAを確認。失敗時は成功と報告しない。チャットへの従来配信は維持する。

## サイト表示

`assets/digest.js` が最新の日付から過去の `data/editorial/YYYY-MM-DD.json` を取得。
日付と重要度・分野・記事検索で絞り込み、記事詳細をページ内で展開する。
データがない場合は「未配信」を表示し、架空のニュースで埋めない。

## 2026-10-22: 定期タスク連携診断

GitHub Actionsは3時間ごとのRSS収集後、`scripts/check_editorial.py` によって
`data/editorial/health.json` を生成する。これには `current_day_present`、`last_published`、
`invalid_editions`、`attempt` が含まれる。RSS収集成功とAI編集版の書き込み成功は別物。

ChatGPT定期タスクはニュース調査に先立って
`data/editorial/attempts/YYYY-MM-DD.json` に
`{ "schema_version": 1, "date": "YYYY-MM-DD", "source": "chatgpt_scheduled_task", "status": "started", "started_at": "...+09:00" }`
を作成・読戻しする。AI編集版のJSONを保存・読戻しできた場合にだけ `status: published`、
`published_commit_sha`、`published_at` に変更する。保存に失敗して更新できる場合は
`status: failed`、`error` を残す。

状態の解釈：
- 当日のattemptなし：定期タスク内でGitHub書き込みを実行できたか不明。接続・承認・指示の実行状況を確認。
- attemptがstarted：小さな書き込みは成功したが編集版本体の確定保存が未了。
- attemptがfailed：記録されたエラーから原因を追う。
- attemptがpublished、当日のJSONが有効：GitHub書き込みは成功。ただしPagesの配備成功とは区別。

公開リポジトリなので、実行ログに個人情報、ChatGPT会話の秘密、APIキーなどを書かない。
GitHub連携がタスク中に使えなくてもChatGPTの従来のニュース配信は維持する。

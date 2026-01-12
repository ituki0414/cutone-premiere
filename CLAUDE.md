# CutOne Premiere Extension - Claude ルール

## 修正の原則（最重要）

**根本的な問題を全て完璧に修正するまで修正し続けること**

1. **その場限りの修正は絶対禁止**
   - 安全チェック、制限値、フォールバックなどで問題を隠蔽しない
   - 「とりあえず動く」コードは書かない
   - エラーを握りつぶさない

2. **本質的な修正のみ行う**
   - 問題の根本原因を特定してから修正する
   - なぜその問題が起きているのかを理解する
   - 原因がわからない場合は、デバッグして調査する

3. **問題解決の手順**
   - まずログ/デバッグ出力で何が起きているか確認
   - 仮説を立てて検証する
   - 根本原因を特定してから修正コードを書く
   - 表面的な対処ではなく、原因の解決をする

4. **やってはいけないこと**
   - 問題を回避するだけの安全チェック追加
   - 「念のため」のフォールバック処理
   - 理由がわからないまま動くようにする修正
   - 症状を抑えるだけで原因を直さない修正

## Git コミットルール

**全ての変更は即座にGitにコミットすること**

1. **コード変更後は必ずコミット**
   - hostscript/index.jsx を変更したら即コミット
   - panel/js/*.js を変更したら即コミット
   - どんな小さな変更でもコミットする

2. **コミットメッセージにバージョン番号を含める**
   - 例: `v16.2 - Use exact timebase for all frame rates`

3. **コミット後は必ずプッシュ**
   ```bash
   git add -A && git commit -m "vX.X - 説明" && git push
   ```

4. **拡張機能ディレクトリへのコピー**
   ```bash
   cp -R /Users/itsukiokamoto/cutone-premiere/* "/Users/itsukiokamoto/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere/"
   ```

## 現在のバージョン

- **ExtendScript (index.jsx)**: v21.0
  - True J-Cut/L-Cut: ビデオとオーディオを別々のタイミングでカット
  - Constant Power: 自動でオーディオトランジション追加
  - 文字起こし: getFirstClipPath, addCaptionsToSequence
  - `sequence.timebase` を直接使用（全フレームレート対応: 23.976, 29.97, etc.）
  - フレーム境界に揃えてカット（映像/音声ズレ防止）
  - バッチ処理対応

- **CEP (cep.js)**: v7.0
  - AI文字起こし: OpenAI Whisper API連携
  - J-Cut: オーディオがビデオより先行（150msオフセット）
  - L-Cut: ビデオがオーディオより先行（150msオフセット）
  - SRTエクスポート機能
  - バッチ処理で進捗表示

## トラブルシューティング

### 拡張機能が更新されない場合
```bash
# CEPキャッシュをクリア
rm -rf ~/Library/Caches/CSXS ~/Library/Caches/com.adobe.CSXS.*

# ファイルをコピー
cp -R /Users/itsukiokamoto/cutone-premiere/* "/Users/itsukiokamoto/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere/"

# Premiere Proを再起動
```

### 以前のバージョンに戻す場合
```bash
git log --oneline  # コミット履歴を確認
git checkout <commit-hash> -- hostscript/index.jsx  # 特定ファイルを復元
```

## 既知の問題と修正履歴

| バージョン | 問題 | 修正内容 |
|-----------|------|---------|
| v16.0 | 映像/音声カット位置ズレ | - |
| v16.1 | 29.97fps等で丸め誤差 | フレーム境界揃え追加 |
| v16.2 | - | timebase直接使用で全fps対応 |
| v16.3 | シーケンス再生不可 | QE APIでin/outクリア |
| v16.4 | - | バッチ処理対応 |
| v19.0 | 進捗が分からない | バッチ処理で進捗表示（%・残り時間） |
| v20.0 | - | silenceAction追加（disable/deleteKeepSpace） |
| v21.0 | J/L-Cut未実装 | True J-Cut/L-Cut + Constant Power実装 |
| v7.0 (CEP) | 文字起こし機能なし | Whisper API連携 + SRTエクスポート |

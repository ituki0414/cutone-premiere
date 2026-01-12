# CutOne Premiere Extension - Claude ルール

## Git コミットルール（最重要）

**全ての変更は即座にGitにコミットすること**

1. **コード変更後は必ずコミット**
   - hostscript/index.jsx を変更したら即コミット
   - panel/js/*.js を変更したら即コミット
   - どんな小さな変更でもコミットする

2. **コミットメッセージにバージョン番号を含める**
   - 例: `v16.0 - Debug version with detailed logging`
   - 例: `v17.0 - Use QE API for in/out points`

3. **コミット後は必ずプッシュ**
   ```bash
   git add -A && git commit -m "vX.X - 説明" && git push
   ```

4. **拡張機能ディレクトリへのコピー**
   ```bash
   cp -R /Users/itsukiokamoto/cutone-premiere/* "/Users/itsukiokamoto/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere/"
   ```

## 現在のバージョン

- **deleteSegmentsUsingTimeCode**: v16.0
  - `sequence.setInPoint(cutStart)` / `sequence.setOutPoint(cutEnd)` で秒単位設定
  - `qeSeq.extract()` でリップル削除

- **processSegments**: v18.0
  - 重複実行防止（クールダウン + ハッシュチェック）

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

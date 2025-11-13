# GitHub Copilot Metrics Dashboard

GitHub Copilotの使用状況とメトリックスを可視化するダッシュボードアプリケーション。

## 機能

- 📊 リアルタイムメトリックス表示
- 👥 アクティブユーザー数の追跡
- 💡 提案数と受け入れ率の分析
- 📈 日別、言語別、エディタ別の詳細な内訳
- 🎨 美しいインタラクティブなチャート

## スクリーンショット

ダッシュボードには以下の情報が表示されます：

- **総アクティブユーザー**: Copilotを使用しているユーザー数
- **総提案数**: Copilotが提案したコード補完の総数
- **受け入れ率**: 提案が受け入れられた割合
- **総シート数**: 組織内のCopilotライセンス数

## 必要要件

- Node.js 14.x 以上
- GitHub Copilot Business または Enterprise アカウント
- GitHub Personal Access Token（`copilot:read` スコープ付き）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd puureq
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`を`.env`にコピーして、必要な情報を設定します：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
# GitHub Personal Access Token with copilot:read scope
GITHUB_TOKEN=ghp_your_token_here

# Your GitHub organization name
GITHUB_ORG=your-organization-name

# Optional: Enterprise slug if using enterprise account
# GITHUB_ENTERPRISE=your-enterprise-slug

# Server port
PORT=3000
```

### 4. GitHub Personal Access Token の作成

1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)" をクリック
3. Token に名前を付ける（例：copilot-dashboard）
4. `copilot:read` スコープを選択
5. "Generate token" をクリック
6. トークンをコピーして `.env` ファイルに貼り付け

### 5. アプリケーションの起動

```bash
npm start
```

ブラウザで `http://localhost:3000` を開いてダッシュボードにアクセスします。

## 使い方

### ダッシュボードの操作

1. **期間選択**: ドロップダウンメニューから表示する期間を選択（7日、14日、28日、90日）
2. **更新**: データを最新の状態に更新
3. **チャート**: インタラクティブなチャートで詳細を確認

### API エンドポイント

- `GET /api/health` - ヘルスチェック
- `GET /api/metrics/usage?since=YYYY-MM-DD&until=YYYY-MM-DD` - 使用状況メトリックス
- `GET /api/metrics/seats` - シート情報

## トラブルシューティング

### "GitHub token or organization not configured" エラー

`.env` ファイルが正しく設定されているか確認してください。

### API エラー

- GitHub Personal Access Token が有効か確認
- `copilot:read` スコープが付与されているか確認
- 組織名が正しいか確認
- GitHub Copilot Business/Enterprise が有効になっているか確認

### データが表示されない

- 選択した期間内にCopilotの使用履歴があるか確認
- ブラウザのコンソールでエラーメッセージを確認

## 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **Charts**: Chart.js
- **API**: GitHub REST API

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！バグ報告や機能リクエストはIssueで受け付けています。

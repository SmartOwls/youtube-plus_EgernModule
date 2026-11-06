# YouTube Plus · Egern 原生模組

將 gogrhw 的 Surge YouTube Plus 模組轉換為 Egern 原生 YAML 與 `ctx` 腳本介面。目標為 iOS Egern 2.20；保留上游去廣告、內容過濾、訂閱頁、PiP／背景播放及雙語字幕處理邏輯。

**目前狀態：14 項模擬測試、JavaScript 語法、YAML 解析與來源雜湊檢查通過；尚未在 Egern／iPhone 或即時 YouTube 流量實測。**

## 安裝與分享

在 Egern 新增遠端「模組」，貼上以下網址並啟用：

```text
https://raw.githubusercontent.com/SmartOwls/youtube-plus_EgernModule/main/YouTube-Plus.Egern.yaml
```

[查看／取得模組 YAML](https://raw.githubusercontent.com/SmartOwls/youtube-plus_EgernModule/main/YouTube-Plus.Egern.yaml)

模組已指向本儲存庫的遠端 JavaScript，不需要另外下載 JS 或調整本機路徑。確認 MITM 已啟用，並已在 iOS 安裝及完全信任你自己的 Egern CA。重新啟動 YouTube 後確認模組與腳本資源無錯誤。

把上述模組網址分享給其他人即可。腳本更新間隔為 86400 秒；需要立即取得新版時，在 Egern 手動更新模組與其腳本資源。主設定引用範例：

```yaml
modules:
  - url: https://raw.githubusercontent.com/SmartOwls/youtube-plus_EgernModule/main/YouTube-Plus.Egern.yaml
    enabled: true
    update_interval: 86400
```

## 功能與限制

- 保留四條廣告回應阻擋、Protobuf 去廣告與內容過濾、首頁導向訂閱頁，以及字幕／Music 歌詞的原始處理路徑。
- 九個原模組選項可由模組環境設定調整。字幕 `AutoCC` 預設關閉，通常需要在 YouTube 選取翻譯語言。
- 同一網址的多個處理步驟整合為依序執行的原生 request／response 管線。
- 原始 PiP 重導規則引用不存在的 `$3`，保留但預設停用；Player 的 PiP／背景播放能力修改仍保留。效果依客戶端、帳號與伺服器而異。
- 訊息體上限為 16 MiB，非 Surge 的無限制；翻譯仍依賴外部服務。
- 這是原生入口加上自帶 API 轉接層，六份上游處理邏輯靜態封裝於腳本中，不依賴 Egern 的 Surge 模組匯入器。

完整細節、相容性範圍、參數及測試限制請見 [技術說明](README.zh-TW.md)。其中「本機匯入」段落適用於離線套件；使用本頁遠端模組網址時無須設定本機腳本路徑。

## 更新與驗證

修改 `bridge.js` 或上游快照後，先建置與驗證，再把來源及產生的 YAML／JS 一起提交至 `main`：

```sh
python -m pip install -r requirements.txt
python build.py
node --check youtube-plus.native.js
node verify.mjs
python validate.py
```

建置網址由 `publish-config.json` 決定。若 fork 此專案，請先把其中 `repository` 改成你自己的 `帳號/儲存庫`，重新建置並更新本 README 的訂閱網址。

上游不會自動同步；更新上游腳本後仍須檢查格式、相容修正與測試結果。`sources.sha256.json` 對應目前包入的來源快照。模擬測試不等同實機測試。

## 來源與署名

原模組及腳本：[gogrhw/surge](https://github.com/gogrhw/surge)。原署名：gogrhw、Maasea、Aioneas、QingRex、VirgilClyne；字幕處理來源含 [DualSubs/YouTube](https://github.com/DualSubs/YouTube) 與 [DualSubs/Universal](https://github.com/DualSubs/Universal)。

本次轉換修正包括 ES module 的 `Database` 宣告、Music 請求 `subtype` 寫入目標，以及原生 API／二進位資料轉接。上游快照本身未修改。

授權與來源範圍請見 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 及 [licenses](licenses/)。DualSubs 的 Apache-2.0 授權文件已附上；這不代表所有上游修改與套件整體已取得統一授權。

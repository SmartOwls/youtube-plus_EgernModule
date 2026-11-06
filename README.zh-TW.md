# YouTube Plus：Egern iOS 2.20 原生轉換

本包是 Egern 原生 YAML 模組 + 原生 `export default async function(ctx)` 腳本。無須匯入 Surge `.sgmodule`，也不依賴 Egern 的 Surge 模組轉換器。為保留 Protobuf 與 DualSubs 功能，六份上游腳本的處理邏輯靜態封裝於一個 JavaScript 檔中，透過自帶相容層轉接到 `ctx`；並非把六份上游程式逐行全面改寫。內部仍有 `$request` 等區域變數，但不需要 Egern 提供這些舊 API。

**狀態：格式、語法、依賴與 14 項模擬測試通過；未在實體 iPhone、Egern 2.20 或即時 YouTube 流量上測試。不能宣稱所有功能已實機驗證。** 官方線上文件會持續更新，並非固定的 2.20 文件快照；採用舊有 `scriptings` 等欄位，未使用 2.21 新增的統一 `rewrites` 引擎。2.20 版本歷史證實原生腳本、模組環境設定及舊腳本相容功能當時已存在，但無法僅憑版本歷史逐項證實每個文件欄位。

## 使用與匯入

必要檔案只有兩個：

1. `YouTube-Plus.Egern.yaml`：原生模組。
2. `youtube-plus.native.js`：包含全部六份上游邏輯的原生腳本，約 1 MB。

先將兩個檔案傳到 iPhone，在 Egern 的本機資源中加入或儲存腳本，再匯入 YAML 作為「模組」，不是拿來覆蓋完整代理設定。兩個原生腳本項目共用同一份 JS。

**腳本位置必須核對：** YAML 中兩處 `script_url` 預設為 `youtube-plus.native.js`。官方允許本機路徑，但沒有在本次查得的文件中保證「相對於模組檔案」解析。請在 Egern 中將這兩處設為該腳本實際的本機資源路徑；若檔名可直接被解析，則不必更改。只匯入 YAML 而沒有可解析的 JS 路徑，腳本不會運作。本包未上傳至公開主機，也沒有虛構可訂閱網址。另一種方式是將 JS 放到你自己的 HTTPS 主機，將兩處 `script_url` 改為同一個可直接讀取 JS 的網址。

啟用模組，確認 MITM 已開啟，並在 iOS 安裝及完全信任你現有的 Egern CA。模組只附加 MITM 主機，不附帶 CA 私鑰或覆蓋憑證。重新開啟 YouTube，檢查資源下載與腳本日誌有無錯誤。若請求走 QUIC 而未進入解密流程，需在現有代理／策略設定中處理 QUIC；本模組不擅自更改整體路由。

## 功能與限制

| 功能 | 轉換方式／狀態 |
|---|---|
| googlevideo、stats、pagead、ptracking、qoe 阻擋 | 四條原生 `map_locals`，保留 HTTP 200 與單一空白文字回應 |
| YouTube App Protobuf 去廣告 | 保留 Browse、Next、Player、Search、Shorts、Guide、Setting、GetWatch 上游處理器；Player 廣告欄位移除已有模擬驗證 |
| Shorts、購物／贊助內容及導覽過濾 | 保留原處理邏輯及參數；實際效果依 YouTube 客戶端回應結構，未實機驗證 |
| 首頁切換訂閱頁 | 保留 Protobuf browseId 修改與訂閱分頁裁切；browseId 改寫、關閉選項及保留其他欄位已有模擬驗證 |
| PiP／背景播放 | 保留 Player `playabilityStatus` 能力修改；實際播放仍取決於 App、帳號及伺服器，不保證等同 Premium |
| 原始 PiP URL 重導 | 保留原規則但 `disabled: true`：原 regex 只有兩個群組，目標卻含 `$3`，且缺少合理的主機捕捉。無法可靠推斷作者意圖，未擅自修改成另一條生效規則 |
| JSON／Protobuf Player 字幕 | 保留 DualSubs 請求與回應處理、AutoCC／ShowOnly／Position 及字幕快取；JSON 請求與回應已有模擬驗證 |
| Timedtext 翻譯／雙語合成 | 保留 Translate、Official／External 回應處理；Translate 的 JSON3 雙語輸出已使用模擬 Google 回應驗證；Official／External 與 VTT／XML 未作完整端到端測試 |
| YouTube Music 歌詞 | 保留 JSON／Protobuf Browse 規則及翻譯器；JSON／Protobuf 歌詞請求的 Translate 路由已有模擬驗證，歌詞回應與實機顯示尚未驗證 |
| 無限制 body 大小 | Surge 的 `max-size=-1` 未直接沿用；改為明確的 16 MiB。超過上限可能不會交給腳本，故無法保證無限制等效 |
| timeout | Egern 原生 hook 設為 120 秒；每個上游階段最多等待 55 秒。重試與外部翻譯仍可能超時；失敗時保留先前已成功的階段結果 |

同一網址重疊的原始規則被合併為一個 request hook 和一個 response hook，按原始檔順序執行。下一階段接收上一階段的結果，避免依賴 Egern 對重疊獨立規則的執行策略。匹配仍以原始 URL 判斷，避免某階段改寫 URL 後讓其他原始規則意外失效。

這是特定上游模組的轉接，不是完整的 Surge 執行環境。只橋接實際選用路徑需要的 API；不提供通用 `$task`、`$prefs`、Node 檔案系統或 Node 套件。包內仍可看到上游其他平台分支的 `require()`，預設 Google／本包選用分支不會執行那些 Node 分支。其他翻譯供應商與自訂金鑰設定不在已驗證範圍。

## 參數

模組的環境設定提供九個原始參數。每個 hook 也寫有明確預設值；模組層 `env` 可依官方優先順序覆蓋它們。

| 參數 | 預設 | 選項 |
|---|---|---|
| blockUpload | true | true / false |
| blockImmersive | true | true / false |
| blockShorts | true | true / false |
| subsTabOnly | true | true / false |
| debug | false | true / false |
| Type | Translate | Official / Translate |
| AutoCC | false | true / false |
| ShowOnly | false | true / false |
| Position | Forward | Forward / Reverse |

字幕目標語言沿用上游預設／快取，沒有擅自加入原模組未提供的語言設定。AutoCC=false 時，通常需要在 YouTube 字幕選單選取翻譯語言才啟動後續處理。`debug=false` 不會關閉 DualSubs 原有的全部一般日誌。

## API 相容性與修正

- `ctx.request`／`ctx.response` 的 body stream 只消耗一次；依原規則提供文字或 `Uint8Array`。回傳時統一處理 `body`、`bodyBytes`、HTTP status，清除失效的長度／壓縮／傳輸編碼標頭。
- `$done` 轉為完成單一階段的 Promise，再由原生函式回傳；request 的直接回應轉成 `ctx.respond()`。
- `$persistentStore` 轉成 `ctx.storage`，使用 `YouTubePlus.Egern.` 前綴隔離資料；不自動匯入 Surge 或其他模組的舊快取。
- `$httpClient` 轉成 `ctx.http`，保留選用路徑的 binary、policy、redirect、cookie、TLS 設定；上游秒制 timeout 轉成原生毫秒。
- `$notification.post` 轉成 `ctx.notify` 的標題、副標題、內文；通知的開啟連結動作未轉接。
- `argument` 由 `ctx.env` 產生，以免將 Surge 專用 argument 欄位誤寫入原生 YAML。
- 上游 Protobuf Music Browse 分支把 `subtype` 寫到全域 `URL` 建構器，沒有更新請求 URL；封裝時改為寫入已解析請求的 `xe.searchParams`。JSON／Protobuf 歌詞請求都通過路由測試，原始快照保持原樣。
- 四份 DualSubs 上游使用 `Database = {...}` 的未宣告賦值；原生 ES module 強制 strict mode，故各自包裝函式加入 `let Database;`。上游檔案本身保持原樣，方便 SHA-256 比對。
- 完整腳本已靜態封裝，不使用 eval、不在執行時下載其他 JS，無需 npm 套件。Google 等翻譯服務及 YouTube 字幕請求仍是必要網路依賴；外部服務失效會影響翻譯。

## 檔案與驗證

`original.sgmodule` 與六份 `youtube*.js` 是下載的上游快照。`sources.sha256.json` 記錄雜湊，`routes.json` 記錄 14 條原規則到原生管線的對照。`upstream-head.json` 與 `upstream-module-commit.json` 是下載後查得的 GitHub 版本紀錄；真正使用的位元組以雜湊為準，下載與查詢並非原子操作。

`bridge.js`、`build.py` 是轉換來源；`verify.mjs`、`validate.py`、`verification.txt` 是模擬與格式檢查紀錄。建置／YAML 驗證需要 Python + PyYAML，模擬測試使用 Node.js；iPhone 執行不需要這些工具。

驗證涵蓋：未匹配 URL、Home／Subscriptions Protobuf 改寫與停用、其他 Protobuf 欄位保留、Player 去廣告、重疊 Player 管線、JSON 字幕請求／回應、Timedtext 子類型改寫、Music JSON／Protobuf 歌詞請求路由、模擬 Google 翻譯的雙語 JSON3、HTTP 二進位／timeout／policy、儲存／通知，以及回傳標頭處理。並檢查 YAML 可解析、兩個本機腳本依賴存在、14 條規則／4 條 Map Local／8 個 MITM 主機／9 個參數及所有來源雜湊。

未涵蓋：Egern 本身 schema 載入器、iOS WebView 資源限制、真實 YouTube 登入帳號、即時廣告、播放、Official 合成、Music 歌詞與外部翻譯服務可用性。匯入後仍需實機確認。

## 查證來源（2026-11-06）

- [原始 Surge 模組](https://raw.githubusercontent.com/gogrhw/surge/refs/heads/main/Modules/youtube-plus.sgmodule)
- [上游六份腳本所在目錄](https://github.com/gogrhw/surge/tree/main/Scripts)
- [Egern Modules](https://egernapp.com/docs/configuration/modules/)
- [Egern Scripting](https://egernapp.com/docs/configuration/scriptings/)
- [Egern JavaScript API](https://egernapp.com/docs/javascript-api/)
- [Egern Environment Variables](https://egernapp.com/docs/configuration/env/)
- [Egern URL Rewriting](https://egernapp.com/docs/configuration/url_rewrites/)
- [Egern 設定範例：Map Local 等](https://egernapp.com/docs/configuration/example/)
- [App Store 版本紀錄：2.20 與 2.21](https://apps.apple.com/us/app/egern/id1616105820)

上游作者署名保留於模組與原始碼。未查得本包六份修改版本的統一授權聲明，未替它們新增或推定授權；對外重新散布前請核對上游與各原始專案授權。

# Django 本機驗證｜2026-10-28

使用者明確核准安裝 Django，僅供本機檢查。套件安裝於本次工作獨立目錄，未修改專案 requirements.txt 或正式站。

- Django 5.2.18；asgiref 3.13.0；sqlparse 0.6.0。
- manage.py check：System check identified no issues。
- 既有 clinic 200 項測試通過。
- 新增 clinic/tests_workflow_http.py 的12項 HTTP 邊界測試通過。
- 最後統一執行完整 clinic 測試：212項，OK；未出現失敗或略過。
- 本機契約125項、協調讀取8情境、來源保護與455個資產雜湊核對仍通過。

新增 HTTP 檢查涵蓋 POS 7種具名動作的原資料轉送、Bearer／POST要求、錯院回覆、非法版本、不支援動作、配藥原送單編號／劑量／帳單、管理者限制、錯單回覆、失聯不重送、禁止前端覆寫院所與待付款編輯／取消權限。

測試設定為 config.settings，SUPABASE_URL 與 SUPABASE_PUBLISHABLE_KEY 清空。上游服務均為本機測試替身；傳輸測試使用本機 HTTP 伺服器。沒有正式病歷、收款、庫存、SQL、登入、LINE推播或部署。

本機 Django HTTP 與函式驗證不等於 Supabase SQL 在正式資料下的執行驗收，也不等於實際瀏覽器操作或速度量測。正式專案版本比對與針對相關流程的最後實操仍屬部署階段。

本次沒有發現需修補的後端失敗；新增的是驗證覆蓋與紀錄，未改變院務業務程式。

## 正式來源合併後重新驗證

正式ZIP的revise病歷版本更新、返回按鈕與備份相容修正已合併。新增5項病歷修訂檢查，完整後端217項通過；另有10種返回看診本機情境通過。此前212項數字是合併前的驗證紀錄，不能拿來代替本次正式來源合併後的結果。

# SQL 整合驗證紀錄

此處為工具端靜態核對，沒有連線使用者的正式／本機資料庫，也沒有要求使用者重做院務功能。

## 已完成

- 原始 1,107 個 SQL 敘述經 PostgreSQL parser 解析後再分段，不用分號直接切割函式 body。
- 整合前後 AST 比對：除了已記錄的 doctor CHECK 與交易區域設定，其餘原始敘述的結構、順序、grants、RLS、索引、trigger 與函式定義保留。
- 114 個函式 body 與原始結構匯出相同；另與盤點 CSV 比對，111 個完全相同、3 個只有一行註解差異，未發現業務內容衝突。
- 54 張表的 617 個欄位與 CSV 完全對應；加上兩個 view 的 66 欄，共 683 欄納入唯讀核對。
- 164 個具名約束（含 constraint trigger）與 CSV 逐名一致。
- 函式輸入簽名唯一，無重複建立同一簽名。
- 127 條資料庫 policy 保留，補進三條原 Storage policy，完整入口共 130 條。
- 15 個 SQL 檔通過 PostgreSQL SQL 解析；完整入口為 1,116 個敘述。
- 13 個 SQL-language 函式 body 通過 SQL 解析。
- 89 個 PL/pgSQL 函式 body 通過離線 PL/pgSQL parser；另 12 個遇到解析器僅支援 pg_catalog/public namespace 的限制，詳見 VALIDATION.json。未將它們算成已完整編譯。
- 完整入口沒有頂層 DROP／DELETE／TRUNCATE／UPDATE；業務函式 body 內原有的操作保留。
- 空白環境檢查、交易包裝、Storage 前置條件及選用角色修正均通過 SQL 語法解析，但未執行其資料庫分支。

## 驗證界線

PostgreSQL parser 不是執行中的 Supabase，不能證明角色權限、extension 安裝、RLS 執行結果、所有函式型別、SQLEditor 執行時限或 Storage 系統版本完全一致。本次沒有做實際空白專案整包執行，也沒有對正式資料庫套用。

完成的是來源快照與已知修正的整合，以及靜態一致性核對；今天已確認的功能測試仍沿用，不因這次排版與封裝而要求全部重測。

## 後續維護

modules 是分段定義來源；00_install_empty.sql 是產生出的完整入口。用 Python 執行 tools/build_install.py 可重新組合；若需重做靜態驗證，tools/validate_sql.py 使用 pglast（本次版本 8.7）。使用者目前不需執行這些工具。

既有正式站未來的真正變更應另加具名 migration，不把完整 installer 反覆套在舊資料庫上，也不刪 SQL Editor 歷史來取代 migration 管理。

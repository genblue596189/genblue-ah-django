# genblue AH｜SQL 整合版 2026-10-21

## 這次完成的是 SQL 整合

本版以今天提供的正式資料庫結構匯出為基準，將已確認的 doctor 角色修正、Storage buckets 與 Storage policies 納入同一個建置入口。不是將舊 ZIP 放在一起，也不是重做院務功能測試。

沒有直接連線正式資料庫，不能聲稱取得匯出之後的新變更；若正式站在快照之後又新增 SQL，須以新的結構差異補入。本版完成的是「提供之快照＋已知修正」的 SQL 整合，不是正式站已套用整合檔。

## 現在要做什麼

**目前正式版與 D 槽測試版均可繼續使用，無須貼上或重新執行完整 SQL。** SQL 檔案散落在 SQL Editor 並不等於資料庫執行時會逐個讀那些檔案；資料庫使用的是已生效的物件定義。本版讓日後保存、維護、建立空白專案與 Django 改造有清楚的結構基準。

## 兩種用途，不可混用

| 情境 | 使用檔案 | 說明 |
| --- | --- | --- |
| 新的空白 Supabase 專案 | `00_install_empty.sql` | 一個完整 SQL 入口；含交易與空白環境檢查，現有資料表存在時會中止 |
| 現有正式／測試資料庫 | `existing/00_read_only_catalog_audit.sql` | 選用唯讀核對；不改結構、不動病歷，不要求現在執行 |
| 舊版確實缺 doctor 角色 | `existing/01_optional_doctor_role.sql` | 選用已知修正；僅接受原快照的限制或整合後限制，其餘停止；目前 D 槽已修正，不需再執行 |
| 後續維護原始定義 | `modules/` | 按依賴順序分段，修改後用 `tools/build_install.py` 產生完整檔；不可再把分段逐一重跑一次 |
| 溯源 | `source/`、`OBJECTS.csv`、`FUNCTIONS.csv` | 原始快照、Storage／extension 設定與物件清單 |

唯讀核對會列出缺少的表／view／索引／函式／欄位／約束／trigger／policy、RLS 狀態與權限原貌。它不是完整 schema diff：同名物件的函式內容、欄位型別、Policy 表達式或額外物件差異，不會僅靠「沒有缺漏列」就被證明相同。

## 收齊的範圍

| 物件 | 數量／內容 |
| --- | --- |
| 資料表 | 54：public 46、booking 5、private 3 |
| 資料表欄位 | 617；另有兩個 view 的 66 欄，盤點共 683 欄 |
| 函式 | 114：public 82、booking 8、private 24；同一輸入簽名沒有重複建立 |
| Views | 2，保留 security_invoker 設定 |
| 約束 | 164 個具名約束（包含 constraint trigger），與盤點逐名核對 |
| 索引 | 55 個明確 CREATE INDEX，加上約束產生的索引，盤點共 123 個 |
| Triggers | 27（含 1 個延後執行的 constraint trigger）；不重複加入 PostgreSQL 外鍵內部 trigger |
| 資料庫 Policies | 127 |
| Storage Policies | 3：authenticated 上傳、讀取、清理；沒有自行新增 UPDATE 或匿名寫入 |
| Storage buckets | clinic-imaging 私有、50 MiB、六種原始 MIME；genblue 公開、原始限制為 NULL |
| 授權 | 保留原 349 個 GRANT／REVOKE 敘述與 12 個 default privilege 敘述；沒有對全部表另加一組 blanket grant |
| RLS | 原 51 張啟用；private 三張保留原所有權／存取控制，不擅自改成另一種權限模型 |
| Identity sequences | 保留原本兩個 identity 序列及授權；不匯入正式站的目前號碼值 |

genblue 是原本公開 bucket，這次如實保存設定，並非判定其中所有檔案都適合公開。沒有封裝任何圖片、病歷、飼主、帳號、token、密碼或使用者金鑰。

## 整合與去重方式

以目前匯出的有效定義為基準，沒有串接歷年 SQL Editor 補丁。每個函式只保留該快照的現行定義；114 個函式與另一份 CSV 盤點交叉核對，111 個 body 相同，3 個只差一行說明註解。原 54 表的欄位、164 個具名約束也與 CSV 逐名核對。

版本名稱不同的函式可能是前端或其他 RPC 仍在呼叫的入口，不能只因 v 編號較舊就刪除。這次保留全部有效入口，不做業務邏輯改寫。函式依賴的 medical_records row type 仍在原本的位置先建立，沒有為了排版而破壞匯出順序。

具體變更只有：

1. user_profiles 角色 CHECK 直接包含 doctor，空白建立不再先建錯誤限制再補一次。
2. 補進盤點中的兩個 Storage bucket 設定與三條原 Policy；表、函式、trigger、RLS、grants 不再分散於臨時修補檔。
3. 在外層加交易、空白環境與 Supabase 前置檢查；原 session 設定改為交易內 SET LOCAL，避免匯入完成後污染連線設定。
4. 製作既有資料庫唯讀核對與有限的角色相容修正；不使用會刪表、清空資料或 DROP SCHEMA 的重建方式處理正式站。

## 模組順序與新建環境前置條件

00 前置檢查 → 01 schemas／交易設定 → 02 函式與 row type 前置表 → 03 其餘表／views／identity → 04 主鍵等約束／索引 → 05 triggers／外鍵 → 06 RLS／policies → 07 逐物件 grants → 08 原 default privileges → 09 Storage → 10 COMMIT。

僅供 PostgreSQL 17+ 的 Supabase 環境，原匯出含 MAINTAIN 權限。需以有建置及 Storage Policy 權限的資料庫管理角色執行，已備妥 Auth／Storage 系統 schemas 與 postgres、pg_database_owner、anon、authenticated、service_role 角色。不得拿來初始化一般空白 PostgreSQL 而忽略 Supabase 系統依賴。

原盤點的 extensions 為 extensions.pg_stat_statements 1.11、extensions.pgcrypto 1.3、extensions.uuid-ossp 1.1、pg_catalog.plpgsql 1.0、vault.supabase_vault 0.3.1。整合檔檢查 extension/schema 是否存在，不替 Supabase 建立或降版系統 extension；版本清單保留供核對，不強制每個修訂號完全一致。

原 dump 使用 check_function_bodies=false，以支援前向依賴；這次保留該方式，沒有宣稱 SQL 解析器能證明所有函式型別與執行時依賴正確。安裝到空白環境的完整執行驗證尚未在這個對話工具環境進行，也不要求使用者重跑今天已通過的院務操作。

新建時以同一連線完整執行 00_install_empty.sql。若任何敘述失敗，停止並 ROLLBACK，不跳過錯誤繼續執行。這不是可對任意既有版本反覆套用的 idempotent migration；完整檔與 modules 二擇一，建議只執行完整檔。

## 明確保留、不混進整理工作的事項

- 原 GIB-TP-001 商品申報條件仍在；要改多院申報是下一個業務變更，不能靠刪除條件當作 SQL 去重。
- can_checkout 與 permission_checkout 尚未統一，是另一項邏輯修改。
- 保留原 public schema 的寬鬆 default privileges；這是來源既有行為，不是本次新增表格的最小授權建議。未來新表仍應逐表明確 grants 與 RLS；要變更原 default privileges 須另作明確權限變更，不藏在結構整理裡。
- 不含 Auth 帳號初始化、院所資料、Storage objects、API exposed schemas、JWT／Edge Functions 設定、Turnstile、排程或外部服務金鑰。這些不是 SQL 結構去重的內容；也不代表今天要再重測它們。

## 驗證與後續

詳見 VALIDATION.md。所有 SQL 通過 PostgreSQL SQL 解析，另核對來源順序、唯一簽名、原始定義保留及變更範圍。這是靜態結構核對，不宣稱已在正式資料庫執行或證明每個 runtime 依賴。

本次 SQL 整理完成後，下一步依原定方向進入 Python／Django 改造。保留已完成的院務驗證，只驗證後續實際修改的部分，不再把全面重測當作前置作業。

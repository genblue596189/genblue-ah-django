# 與原始快照的差異

| 項目 | 原始 | 整合後 |
| --- | --- | --- |
| user_profiles_role_check | owner/admin/vet/staff | 加入已在本機確認的 doctor，保留四個原角色 |
| Session 設定 | SET／set_config(...,false) | 包在一個交易，改為 SET LOCAL／set_config(...,true) |
| Storage bucket 設定 | 另存在盤點 CSV | 兩個來源 bucket 直接納入完整 SQL |
| Storage Policy | 另存在盤點／獨立修補檔 | 三條來源規則納入完整 SQL，補完整 schema 名稱 |
| 新建入口 | baseline＋角色修補＋手建 bucket＋Storage 修補 | 00_install_empty.sql 一個入口，內含前置檢查與交易 |
| 已有專案 | 無區分容易誤貼完整結構 | 唯讀 audit 與選用角色修正分開提供 |

114 個函式 body 未修改；沒有把 checkout、試用、人員、庫存、預約邏輯重寫，也沒有刪除不同版本名稱的有效函式。原 default privileges 亦原樣保留並在 README 說明。

這次沒有要求重做手動功能驗證，也沒有套用任何正式 SQL。未取得來源快照之後的即時正式結構，不能把此包解讀成即時同步工具。

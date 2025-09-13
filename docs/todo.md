資料邏輯

1. 創建 event 時將 ID 儲存在 db 中，方便未來對照
2. 載入網頁時比照目前 Calendar 上的 event 和 db 中的 event，若一個 event 在 Calendar 端被刪除那就再同步時直接從 db 刪除
3. 要避免同步時明明該時段已經有相同課表在，還創建新的 event 讓時段有複數個相同行程

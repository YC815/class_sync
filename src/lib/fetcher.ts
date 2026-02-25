export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    // 嘗試讀取錯誤訊息以提供更詳細的資訊
    let errorMessage = `HTTP ${res.status}`
    try {
      const errorBody = await res.text()
      if (errorBody) {
        // 嘗試解析 JSON 錯誤訊息
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.error || errorJson.message) {
            errorMessage += `: ${errorJson.error || errorJson.message}`
          } else {
            errorMessage += `: ${errorBody.substring(0, 200)}`
          }
        } catch {
          // 不是 JSON，直接使用文字
          errorMessage += `: ${errorBody.substring(0, 200)}`
        }
      }
    } catch {
      // 無法讀取 body，使用 status text
      errorMessage += ` ${res.statusText}`
    }
    throw new Error(errorMessage)
  }
  return res.json()
}

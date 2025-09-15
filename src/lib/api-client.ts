interface ApiError extends Error {
  status?: number
  response?: {
    status: number
    data: any
  }
}

export class ApiClient {
  private onAuthError?: (error: ApiError) => void

  constructor(onAuthError?: (error: ApiError) => void) {
    this.onAuthError = onAuthError
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: 'unauthorized', message: '認證失敗' }
      }

      const error: ApiError = new Error('Authentication failed')
      error.status = 401
      error.response = {
        status: 401,
        data: errorData
      }

      if (this.onAuthError) {
        this.onAuthError(error)
      }

      throw error
    }

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: 'unknown', message: `HTTP ${response.status}` }
      }

      const error: ApiError = new Error(errorData.message || `HTTP ${response.status}`)
      error.status = response.status
      error.response = {
        status: response.status,
        data: errorData
      }

      throw error
    }

    try {
      return await response.json()
    } catch {
      return null
    }
  }

  async get(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    return this.handleResponse(response)
  }

  async post(url: string, data?: any, options?: RequestInit) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })

    return this.handleResponse(response)
  }

  async put(url: string, data?: any, options?: RequestInit) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })

    return this.handleResponse(response)
  }

  async delete(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    return this.handleResponse(response)
  }
}

export function createApiClient(onAuthError?: (error: ApiError) => void) {
  return new ApiClient(onAuthError)
}
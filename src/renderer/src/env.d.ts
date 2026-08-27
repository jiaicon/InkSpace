/// <reference types="vite/client" />

import type { User, UserInput, SystemInfo, IpcResult } from '@shared/types'

declare global {
  interface Window {
    api: {
      user: {
        list: () => Promise<IpcResult<User[]>>
        create: (input: UserInput) => Promise<IpcResult<number>>
        update: (id: number, input: UserInput) => Promise<IpcResult<boolean>>
        remove: (id: number) => Promise<IpcResult<boolean>>
      }
      system: {
        getInfo: () => Promise<IpcResult<SystemInfo>>
      }
    }
  }
}

export {}

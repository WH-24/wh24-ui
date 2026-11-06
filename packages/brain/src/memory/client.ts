/** Клиент личной памяти (`/me/memory*`). Строится поверх `request` из `createBrainApi`. */
import type { Requester } from '../agents/client.js'
import {
  DEFAULT_MEMORY_LIMITS,
  type MemoryImportResult,
  type MemoryItem,
  type MemoryItemDraft,
  type MemoryUpdate,
  type UserMemory,
} from './types.js'

export interface MemoryApi {
  get(): Promise<UserMemory>
  /** Частичное обновление: `enabled`, `nickname`, `role`. Ответ — вся память. */
  update(patch: MemoryUpdate): Promise<UserMemory>
  addItem(body: MemoryItemDraft): Promise<MemoryItem>
  removeItem(id: string): Promise<void>
  /** «Забыть всё»: записи, обращение и роль; переключатель `enabled` сохраняется. */
  forget(): Promise<void>
  /** Перенос памяти из другого ассистента: строки и пункты списка становятся записями. */
  importText(text: string): Promise<MemoryImportResult>
}

export interface MemoryClient {
  memory: MemoryApi
}

const seg = encodeURIComponent

function normalize(res: Partial<UserMemory> | undefined): UserMemory {
  return {
    enabled: res?.enabled !== false,
    nickname: res?.nickname ?? '',
    role: res?.role ?? '',
    items: res?.items ?? [],
    limits: { ...DEFAULT_MEMORY_LIMITS, ...(res?.limits ?? {}) },
  }
}

export function createMemoryClient(request: Requester): MemoryClient {
  return {
    memory: {
      async get() {
        return normalize(await request<Partial<UserMemory> | undefined>('GET', '/me/memory'))
      },
      async update(patch) {
        return normalize(await request<Partial<UserMemory> | undefined>('PUT', '/me/memory', patch))
      },
      async addItem(body) {
        return (await request<{ item: MemoryItem }>('POST', '/me/memory/items', body)).item
      },
      async removeItem(id) {
        await request<unknown>('DELETE', `/me/memory/items/${seg(id)}`)
      },
      async forget() {
        await request<unknown>('DELETE', '/me/memory')
      },
      async importText(text) {
        const res = await request<Partial<MemoryImportResult> | undefined>('POST', '/me/memory/import', { text })
        return { added: res?.added ?? 0, skipped: res?.skipped ?? 0, items: res?.items ?? [] }
      },
    },
  }
}

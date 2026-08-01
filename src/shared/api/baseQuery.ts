import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'

export interface PocketbaseQueryError {
  status: number
  message: string
  data?: unknown
}

export interface PocketbaseListParams {
  page?: number
  perPage?: number
  filter?: string
  sort?: string
  expand?: string
}

export type PocketbaseBaseQueryArgs =
  | { collection: string; method: 'getList'; params?: PocketbaseListParams }
  | {
      collection: string
      method: 'getFullList'
      params?: Omit<PocketbaseListParams, 'page' | 'perPage'>
    }
  | { collection: string; method: 'getOne'; id: string; expand?: string }
  | { collection: string; method: 'getFirstListItem'; filter: string; expand?: string }
  | { collection: string; method: 'create'; body: Record<string, unknown> }
  | {
      collection: string
      method: 'update'
      id: string
      body: Record<string, unknown>
    }
  | { collection: string; method: 'delete'; id: string }

const toQueryError = (error: unknown): PocketbaseQueryError => {
  if (error instanceof ClientResponseError) {
    return { status: error.status, message: error.message, data: error.response }
  }
  return {
    status: 0,
    message: error instanceof Error ? error.message : 'Unknown error',
  }
}

export const pocketbaseBaseQuery: BaseQueryFn<
  PocketbaseBaseQueryArgs,
  unknown,
  PocketbaseQueryError
> = async (args) => {
  try {
    const collection = pb.collection(args.collection)

    switch (args.method) {
      case 'getList': {
        const { page = 1, perPage = 50, filter, sort, expand } = args.params ?? {}
        const data = await collection.getList(page, perPage, { filter, sort, expand })
        return { data }
      }
      case 'getFullList': {
        const { filter, sort, expand } = args.params ?? {}
        const data = await collection.getFullList({ filter, sort, expand })
        return { data }
      }
      case 'getOne': {
        const data = await collection.getOne(args.id, { expand: args.expand })
        return { data }
      }
      case 'getFirstListItem': {
        const data = await collection.getFirstListItem(args.filter, { expand: args.expand })
        return { data }
      }
      case 'create': {
        const data = await collection.create(args.body)
        return { data }
      }
      case 'update': {
        const data = await collection.update(args.id, args.body)
        return { data }
      }
      case 'delete': {
        await collection.delete(args.id)
        return { data: null }
      }
    }
  } catch (error) {
    return { error: toQueryError(error) }
  }
}

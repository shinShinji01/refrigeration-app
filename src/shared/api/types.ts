export type IsoDateString = string

// Общие поля, которые PocketBase добавляет каждой (не системной) коллекции.
export interface BaseRecord {
  id: string
  created: IsoDateString
  updated: IsoDateString
}

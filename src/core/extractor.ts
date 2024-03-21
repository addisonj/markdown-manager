import {IDocRepo, PathDocId} from './types'

export type Extraction<T = any, N = any> = {
  extractorName: string
  // if docId is present, it means the data is associated with a specific doc
  // if it is null, then the data is "global" for all documents
  globalData?: T
  docData?: { [docId: string]: N }
}

export type IExtractor<T = any, N = any> = {
  name: string
  requiresLoad: boolean
  extract(repo: IDocRepo): Promise<Extraction<T, N>>
}

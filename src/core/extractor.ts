import type { IDocRepo } from './types.js'

export type Extraction<GlobalData = any, NodeData = any> = {
  extractorName: string
  // if docId is present, it means the data is associated with a specific doc
  // if it is null, then the data is "global" for all documents
  globalData?: GlobalData
  docData?: { [docId: string]: NodeData }
}

export type IExtractor<T = any, N = any> = {
  name: string
  requiresLoad: boolean
  extract(repo: IDocRepo): Promise<Extraction<T, N>>
}

import {IDocRepo, PathDocId} from './types'

export type Extraction<T = any> = {
  docId: PathDocId
  data: T
}

export type IExtractor<T = any> = {
  name: string
  requiresLoad: boolean
  extract(repo: IDocRepo): Promise<Extraction<T>[]>
}

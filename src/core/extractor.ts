import {IDocRepo, DocId} from './types'

export type Extraction<T = any> = {
  docId: DocId
  data: T
}
export type IExtractor<T = any> = {
  extract(repo: IDocRepo): Promise<Extraction<T>[]>
}

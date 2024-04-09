import type {
  DocIndex,
  Extraction,
  IDocRepo,
  IExtractor,
} from '../../core/index.js'

/**
 * This extractor is used to extract a search index from the tree structure of the documents by
 * using the `extractIndex` method
 */
export class SearchIndex implements IExtractor {
  name: string = 'search-index'
  requiresLoad: boolean = true
  async extract(repo: IDocRepo): Promise<Extraction<never, DocIndex>> {
    const docs = await repo.docs()
    const indexByDoc: Record<string, DocIndex> = {}
    for (const doc of docs) {
      const relPath = doc.relPath
      try {
        const loadedDoc = await doc.load()
        const index = await loadedDoc.extractIndex()
        indexByDoc[relPath] = index
      } catch (ex: any) {
        // just continue on if something fails
        console.error(`Error extracting index for ${relPath}: ${ex.message}`)
      }
    }
    return {
      extractorName: this.name,
      docData: indexByDoc,
    }
  }
}

import { IDirNode, IDocNode, ILoadedDocNode, IMediaNode } from './types'

export type IEnrichment = {
  /**
   * the name of the enrichment
   */
  name: string
  /**
   * the fields where metadata will be added
   */
  metadataFields: string[]
  /**
   * A description of the enrichment
   */
  description?: string
  /**
   * Enrich a document node
   * @param node the node to enrich
   * @returns the updated node, or null/undefined to remove it
   */
  enrichDoc?: (
    node: IDocNode
  ) => Promise<IDocNode | undefined | null>
  /**
   * Enrich a directory node
   * @param node the node to enrich
   * @returns the updated node, or null/undefined to remove it. If removed, all children directories will be ignored
   * 
   */
  enrichDir?: (node: IDirNode) => Promise<IDirNode | undefined | null>

  /**
   * Enrich a media node
   * @param node the node to enrich
   * @returns the updated node, or null/undefined to remove it
   */
  enrichMedia?: (node: IMediaNode) => Promise<IMediaNode | undefined | null>
}

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
   * Indicates when the enrichment will be applied, either when a document/dir is found or when it is loaded
   * NOTE: enrichDir and enrichMedia are only called when lifecycle is 'onDiscovery'
   */
  lifecycle: 'onDiscovery' | 'onLoad'
  /**
   * Enrich a document node, if onDisovery, then it is IDocNode, if onLoad it is ILoadedDocNode
   * @param node the node to enrich
   * @returns the updated node
   */
  enrichDoc?: (
    node: IDocNode | ILoadedDocNode
  ) => Promise<IDocNode | ILoadedDocNode>
  /**
   * Enrich a directory node
   * @param node the node to enrich
   * @returns the updated node
   */
  enrichDir?: (node: IDirNode) => Promise<IDirNode>
  /**
   * Enrich a media node
   * @param node the node to enrich
   * @returns the updated node
   */
  enrichMedia?: (node: IMediaNode) => Promise<IMediaNode>
}

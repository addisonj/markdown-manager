import {
  IDirNode,
  IDocNode,
  IEnrichment,
  ILoadedDocNode,
  NavNode,
  isDirNode,
  isDocNode,
} from '../../core'
import path from 'path'
const DefaultTitleIndexVersionRegex =
  /^(?<idx>\d+)?\s*-?\s*(?<version>v\d+(\.\d+)?(\.\d+)?)?\s*-?\s*(?<name>.*)/
export type ExtractedInfo = {
  title: string
  version?: string
  index?: number
}
export class TitleIndexVersionEnrichment implements IEnrichment {
  metadataFields: string[] = []
  description?: string =
    'Extracts title, version, and index from the file path using a regex'
  lifecycle: 'onDiscovery' | 'onLoad' = 'onDiscovery'
  constructor(
    private titleIndexVersionRegex: RegExp = DefaultTitleIndexVersionRegex
  ) {}
  extractTitleVersionIndex(
    fullPath: string,
  ): ExtractedInfo | undefined {
    const parsed = path.parse(fullPath)
    const match = parsed.name.match(this.titleIndexVersionRegex)
    if (!match) {
      return
    }
    return {
      title: match.groups?.name || '',
      version: match.groups?.version,
      index: match.groups?.idx ? parseInt(match.groups?.idx) : undefined,
    }
  }
  enrichBase<T extends NavNode>(
    node: T 
  ): T {
    const info = this.extractTitleVersionIndex(node.relPath)
    if (info) {
      node.navTitle = info.title
      if (info.version) {
        node.pathId.version = info.version
      }
      if (info.index) {
        node.index = info.index
      }
    }
    return node
  }
  enrichDoc(
    node: IDocNode | ILoadedDocNode
  ): Promise<IDocNode | ILoadedDocNode> {
    if (isDocNode(node)) {
      return Promise.resolve(this.enrichBase<IDocNode>(node))
    }
    return Promise.resolve(node)
  }
  enrichDir(node: IDirNode): Promise<IDirNode> {
    if (isDirNode(node)) {
      return Promise.resolve(this.enrichBase<IDirNode>(node))
    }
    return Promise.resolve(node)
  }
  name = 'title-index-version-enrichment'
}
import { SourceConfig } from './config'
import { IExtractor } from './extractor'
import { MultiSource } from './multi_source'
import {
  IDocNode,
  IDocRepo,
  IDocTree,
  IMediaNode,
  Node,
  isDocNode,
  isMediaNode,
} from './types'
import { IValidator, ValidationError } from './validator'

export class DocRepo implements IDocRepo {
  private source: MultiSource
  private mergedTree: IDocTree
  private docCache: Record<string, { versions: Record<string, IDocNode> }> = {}
  private mediaCache: Record<string, { versions: Record<string, IMediaNode> }> =
    {}
  constructor(
    public repoName: string,
    private docTrees: IDocTree[],
    private validators: IValidator[],
    // TODO add methods to extractors
    private extractors: IExtractor[]
  ) {
    this.source = new MultiSource(this.docTrees)
    this.mergedTree = this.source.buildTreeSync()
    this.buildCaches()
  }
  private buildCaches() {
    //reset the cache
    this.docCache = {}
    this.mediaCache = {}
    for (const node of this.walkBfs()) {
      if (isDocNode(node)) {
        if (!this.docCache[node.id.id]) {
          this.docCache[node.id.id] = { versions: {} }
        }
        this.docCache[node.id.id].versions[node.id.version] = node
      } else if (isMediaNode(node)) {
        if (!this.mediaCache[node.id.id]) {
          this.mediaCache[node.id.id] = { versions: {} }
        }
        this.mediaCache[node.id.id].versions[node.id.version] = node
      }
    }
  }
  docs(): Promise<IDocNode[]> {
    const allDocs = []
    for (const id in this.docCache) {
      for (const version in this.docCache[id].versions) {
        allDocs.push(this.docCache[id].versions[version])
      }
    }
    return Promise.resolve(allDocs)
  }
  doc(id: string, version?: string | undefined): Promise<IDocNode[]> {
    const docCol = this.docCache[id]
    if (!docCol) {
      return Promise.resolve([])
    }
    if (!version) {
      return Promise.resolve(Object.values(docCol.versions))
    }
    const doc = docCol.versions[version]
    if (doc) {
      return Promise.resolve([doc])
    }
    return Promise.resolve([])
  }
  media(): Promise<IMediaNode[]> {
    const allMedia = []
    for (const id in this.mediaCache) {
      for (const version in this.mediaCache[id].versions) {
        allMedia.push(this.mediaCache[id].versions[version])
      }
    }
    return Promise.resolve(allMedia)
  }
  mediaItem(id: string, version?: string | undefined): Promise<IMediaNode[]> {
    const mediaCol = this.mediaCache[id]
    if (!mediaCol) {
      return Promise.resolve([])
    }
    if (!version) {
      return Promise.resolve(Object.values(mediaCol.versions))
    }
    const media = mediaCol.versions[version]
    if (media) {
      return Promise.resolve([media])
    }
    return Promise.resolve([])
  }
  validate(): Promise<ValidationError[]> {
    return Promise.all(this.validators.map((v) => v.validate(this))).then((v) =>
      v.flat()
    )
  }
  *walkBfs(): Generator<Node, void, unknown> {
    yield* this.mergedTree.walkBfs()
  }
}

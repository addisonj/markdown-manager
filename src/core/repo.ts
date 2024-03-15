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
    private _validators: IValidator[],
    private _extractors: IExtractor[]
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
        if (!this.docCache[node.pathId.path]) {
          this.docCache[node.pathId.path] = { versions: {} }
        }
        this.docCache[node.pathId.path].versions[node.pathId.version] = node
      } else if (isMediaNode(node)) {
        if (!this.mediaCache[node.pathId.path]) {
          this.mediaCache[node.pathId.path] = { versions: {} }
        }
        this.mediaCache[node.pathId.path].versions[node.pathId.version] = node
      }
    }
  }
  get extractors(): IExtractor[] {
    return [...this._extractors, ...this.source.defaultExtractors()]
  }
  get validators(): IValidator[] {
    return [...this._validators, ...this.source.defaultValidators()]
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
    return this.validateSet(this.validators)
  }
  extract(): Promise<Record<string, any>> {
    return this.extractSet(this.extractors)
  }
  extractSet(extractors: IExtractor[]): Promise<Record<string, any>> {
    return Promise.all(extractors.map((v) => v.extract(this))).then((v) =>
      v.reduce((acc, cur) => ({ ...acc, ...cur }), {})
    )
  }
  validateSet(validators: IValidator[]): Promise<ValidationError[]> {
    return Promise.all(validators.map((v) => v.validate(this))).then((v) =>
      v.flat()
    )
  }

  *walkBfs(): Generator<Node, void, unknown> {
    yield* this.mergedTree.walkBfs()
  }
}

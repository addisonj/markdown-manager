import type { Extraction, IExtractor } from './extractor.js'
import { MultiSource } from './multi_source.js'
import type { IDocNode, IDocRepo, IDocTree, IMediaNode, Node } from './types.js'
import { isDocNode, isMediaNode } from './types.js'
import type { IValidator, ValidationError } from './validator.js'

export class DocRepo implements IDocRepo {
  private source: MultiSource
  private mergedTree: IDocTree
  private docCache: Record<string, IDocNode[]> = {}
  private docByUrlCache: Record<string, IDocNode[]> = {}
  private mediaCache: Record<string, IMediaNode[]> = {}
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
    this.docByUrlCache = {}
    this.mediaCache = {}
    for (const node of this.walkBfs()) {
      if (isDocNode(node)) {
        if (!this.docCache[node.relPath]) {
          this.docCache[node.relPath] = []
        }
        if (!this.docByUrlCache[node.webUrl]) {
          this.docByUrlCache[node.webUrl] = []
        }
        this.docCache[node.relPath].push(node)
        this.docByUrlCache[node.webUrl].push(node)
      } else if (isMediaNode(node)) {
        if (!this.mediaCache[node.relPath]) {
          this.mediaCache[node.relPath] = []
        }
        this.mediaCache[node.relPath].push(node)
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
    for (const path in this.docCache) {
      allDocs.push(...this.docCache[path])
    }
    return Promise.resolve(allDocs)
  }
  docByPath(path: string): Promise<IDocNode[]> {
    return Promise.resolve(this.docCache[path] || [])
  }
  docByUrl(url: string): Promise<IDocNode[]> {
    return Promise.resolve(this.docByUrlCache[url] || [])
  }
  media(): Promise<IMediaNode[]> {
    const allMedia = []
    for (const path in this.mediaCache) {
      allMedia.push(...this.mediaCache[path])
    }
    return Promise.resolve(allMedia)
  }
  mediaItemByPath(path: string): Promise<IMediaNode[]> {
    return Promise.resolve(this.mediaCache[path] || [])
  }
  validate(): Promise<ValidationError[]> {
    return this.validateSet(this.validators)
  }
  extract(): Promise<Extraction[]> {
    return this.extractSet(this.extractors)
  }
  extractSet(extractors: IExtractor[]): Promise<Extraction[]> {
    return Promise.all(extractors.map(async (v) => await v.extract(this)))
  }
  validateSet(validators: IValidator[]): Promise<ValidationError[]> {
    return Promise.all(validators.map((v) => v.validate(this))).then((v) =>
      v.flat()
    )
  }

  *walkBfs(): Generator<Node, void, unknown> {
    yield* this.mergedTree.walkBfs()
  }

  tree(): Promise<IDocTree> {
    return Promise.resolve(this.mergedTree)
  }
}

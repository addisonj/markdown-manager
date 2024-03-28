import path from 'path'
import { SourceConfig } from './config'
import { IEnrichment } from './enrichment'
import { IExtractor } from './extractor'
import { AbstractBaseTree } from './tree'
import {
  DocProvider,
  IDirNode,
  IDocNode,
  IDocSource,
  IDocTree,
  Node,
  isDirNode,
} from './types'
import { IValidator } from './validator'
import { dir } from 'console'
import { Interface } from 'readline/promises'
import { Readable } from 'stream'

/**
 * A noop provider as doc nodes have already been built
 */
export class MultiProvider implements DocProvider {
  defaultExtractors(): IExtractor[] {
    return []
  }
  defaultValidators(): IValidator[] {
    return []
  }
  defaultEnrichments(): IEnrichment[] {
    return []
  }
  name: string = 'multi'
  buildDocNode(
    source: IDocSource,
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<IDocNode> {
    throw new Error('Method not implemented.')
  }
}

export class MultiTree extends AbstractBaseTree {
  dedupe(allNodes: Node[]): Node[] {
    const merged = new Map<string, Node>()
    allNodes.forEach((n) => {
      const fp = path.join(n.source.sourceRoot, n.relPath)
      if (merged.has(fp)) {
        merged.get(fp)!.merge(n)
      } else {
        merged.set(fp, n)
      }
    })
    return Array.from(merged.values())
  }
  dedupeTrees(trees: IDocTree[]): Node[] {
    const allNodes = trees.flatMap((t) => t.children)
    return this.dedupe(allNodes)
  }
  constructor(
    public source: MultiSource,
    private trees: IDocTree[]
  ) {
    // satisfy the interface
    super(source, [])
    // we need to flatten the trees into a single tree and we do this by:
    // 1. using the root, check if the directories are the same
    // 2. if they are, we merge the directories, by merging the metadata and the children
    // 3. if we have duplicate files (which means two different sources have the same file), we throw an error
    this.children = this.dedupeTrees(trees)
  }

  findNodeByRelPath(relPath: string): Node | undefined {
    return this.trees
      .map((t) => t.findNodeByRelPath(relPath))
      .find((n) => n !== undefined)
  }
}
/**
 * A source for combining multiple sources into a single tree
 */
export class MultiSource implements IDocSource {
  sourceName: string = 'multi'
  provider: DocProvider = new MultiProvider()
  enrichments: IEnrichment[] = []
  // satisfy the interface, but it isn't really used by us!
  public config: SourceConfig = {} as SourceConfig
  constructor(public trees: IDocTree[]) {}
  private sources(): IDocSource[] {
    return this.trees.map((t) => t.source)
  }
  defaultExtractors(): IExtractor[] {
    // dedupe the extractors by name
    return this.sources()
      .flatMap((s) => s.provider.defaultExtractors())
      .reduce((acc, cur) => {
        if (acc.find((e) => e.name === cur.name)) {
          return acc
        }
        return acc.concat([cur])
      }, [] as IExtractor[])
  }
  defaultValidators(): IValidator[] {
    // dedupe the validators by name
    return this.sources()
      .flatMap((s) => s.provider.defaultValidators())
      .reduce((acc, cur) => {
        if (acc.find((e) => e.name === cur.name)) {
          return acc
        }
        return acc.concat([cur])
      }, [] as IValidator[])
  }
  defaultEnrichments(): IEnrichment[] {
    // enrichments run per source, so we don't need to dedupe them and we just assume an empty set here
    return []
  }
  sourceRoot: string = ''
  sourceType: string = 'multi'
  buildTree(): Promise<IDocTree> {
    return Promise.resolve(this.buildTreeSync())
  }
  buildTreeSync(): IDocTree {
    return new MultiTree(this, this.trees)
  }
  private findDoc(relPath: string): Node | undefined {
    return this.trees
      .map((t) => t.findNodeByRelPath(relPath))
      .find((d) => d !== undefined)
  }
  readFileRaw(relPath: string): Promise<ArrayBuffer> {
    const node = this.findDoc(relPath)
    if (!node) {
      throw new Error(`Could not find document with path ${relPath}`)
    }

    return node.source.readFileRaw(relPath)
  }
  readFileStream(relPath: string): Promise<Readable> {
    const node = this.findDoc(relPath)
    if (!node) {
      throw new Error(`Could not find document with path ${relPath}`)
    }
    return node.source.readFileStream(relPath)
  }
  readFileLinesStream(relPath: string): Promise<Interface> {
    const node = this.findDoc(relPath)
    if (!node) {
      throw new Error(`Could not find document with path ${relPath}`)
    }
    return node.source.readFileLinesStream(relPath)
  }
}

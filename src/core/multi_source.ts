import { SourceConfig } from './config'
import { IEnrichment } from './enrichment'
import { IExtractor } from './extractor'
import { AbstractBaseTree } from './tree'
import { DocProvider, IDirNode, IDocNode, IDocSource, IDocTree } from './types'
import { IValidator } from './validator'

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
  constructor(
    public source: MultiSource,
    trees: IDocTree[]
  ) {
    const allNodes = trees.flatMap((t) => t.children)
    super(source, allNodes)
  }
}
/**
 * A source for combining multiple sources into a single tree
 */
export class MultiSource implements IDocSource {
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
}

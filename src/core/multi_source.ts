import { SourceConfig } from "./config";
import { AbstractBaseTree } from "./tree";
import { DocProvider, IDirNode, IDocNode, IDocSource, IDocTree } from "./types";

/**
 * A noop provider as doc nodes have already been built
 */
export class MultiProvider implements DocProvider {
  name: string = 'multi'
  buildDocNode(source: IDocSource, fullPath: string, index: number, parent?: IDirNode | undefined): Promise<IDocNode> {
    throw new Error('Method not implemented.')
  }
}

export class MultiTree extends AbstractBaseTree {
  constructor(public source: MultiSource, trees: IDocTree[]) {
    const allNodes = trees.flatMap((t) => t.children)
    super(source, allNodes)
  }
}
/**
 * A source for combining multiple sources into a single tree
 */
export class MultiSource implements IDocSource {
  provider: DocProvider = new MultiProvider()
  // satisfy the interface, but it isn't really used by us!
  public config: SourceConfig = {} as SourceConfig
  constructor(public trees: IDocTree[]) {
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
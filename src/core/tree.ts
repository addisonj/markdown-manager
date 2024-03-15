import { BaseFileSource } from './file_source'
import { IDocSource, IDocTree, IMediaNode, NavNode, Node, isDirNode, isDocNode, isMediaNode } from './types'


export abstract class AbstractBaseTree implements IDocTree {
  constructor(public source: IDocSource, public children: Node[]) {
  }
  navChildren(): NavNode[] {
    return this.children.flatMap((n) => {
      if (isDirNode(n) || isDocNode(n)) {
        return [n]
      }
      return []
    })
  }
  *walkBfs(): Generator<Node, void, unknown> {
    for (const child of this.children) {
      yield child
      if (isDirNode(child)) {
        yield* child.walkBfs()
      }
    }
  }
  getMediaNodes = async (): Promise<IMediaNode[]> => {
    const mediaNodes: IMediaNode[] = []
    for (let node of this.walkBfs()) {
      if (isMediaNode(node)) {
        mediaNodes.push(node as IMediaNode)
      }
    }
    return mediaNodes
  }
}

export class BaseDocTree extends AbstractBaseTree {
  constructor(public source: BaseFileSource, public children: Node[]) {
    super(source, children)
  }
}

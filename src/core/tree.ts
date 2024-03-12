import { IDocTree, IMediaNode, NavNode, Node, isDirNode, isDocNode, isMediaNode } from './types'


export class BaseDocTree implements IDocTree {
  children: Node[]
  constructor(children: Node[]) {
    this.children = children
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

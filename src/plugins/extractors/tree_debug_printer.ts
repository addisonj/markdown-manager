import type {
  Extraction,
  IDirNode,
  IDocRepo,
  IDocTree,
  IExtractor,
  Node,
} from '../../core/index.js'
import { isDirNode, isDocNode, isMediaNode } from '../../core/index.js'

/**
 * This extractor is used to debug the tree structure of the documents by
 * creating a string representation of the tree.
 */
export class TreeDebugPrinter implements IExtractor {
  name: string = 'tree-debug-printer'
  requiresLoad: boolean = false
  async extract(repo: IDocRepo): Promise<Extraction<string, never>> {
    return {
      extractorName: this.name,
      globalData: this.printTree(await repo.tree()),
    }
  }

  printNodeHeader(node: Node): string {
    const prefix = `${'  '.repeat(node.depth)} ${node.type} at ${node.relPath} (from ${node.source.sourceName}):`
    if (isDocNode(node)) {
      return `${prefix} ${node.navTitle}`
    } else if (isDirNode(node)) {
      return `${prefix} with ${node.children.length} children`
    } else if (isMediaNode(node)) {
      return `${prefix} with media type ${node.mediaType}`
    }
    return `${prefix} unknown node type`
  }
  printChildren(children: Node[]): string[] {
    return children.flatMap((c) => {
      let lines = []
      lines.push(this.printNodeHeader(c))
      if (isDirNode(c)) {
        // get the file/media nodes first
        const dirs: IDirNode[] = []
        const others: Node[] = []
        c.children.forEach((child) => {
          if (isDirNode(child)) {
            dirs.push(child)
          } else if (isDocNode(child)) {
            others.push(child)
          }
        })
        lines.push(...this.printChildren(others))
        lines.push(...this.printChildren(dirs))
      }
      return lines
    })
  }
  printTree(node: IDocTree): string {
    return `
Tree(${node.source.sourceName})
${this.printChildren(node.children).join('\n')}
`
  }
}

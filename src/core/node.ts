import { IPVersion } from 'net'
import { AbstractFileSourceType } from './source'
import {
  DocId,
  IDirNode,
  IDocNode,
  IMediaNode,
  IParsedDocNode,
  NavNode,
  Node,
  isDirNode,
  isDocNode,
  MediaType,
} from './types'

export class FileDirNode implements IDirNode {
  relPath: string
  type: 'directory'
  id: DocId
  index: number
  depth: number
  parent?: IDirNode | undefined
  navTitle: string
  hidden: boolean
  children: Node[]
  constructor(
    source: AbstractFileSourceType,
    relPath: string,
    index: number,
    parent?: IDirNode | undefined
  ) {
    this.relPath = relPath
    const info = source.extractTitleVersionIndex(relPath, index, parent)
    this.type = 'directory'
    this.id = {
      id: source.buildId(info.title),
      version: info.version,
    }
    this.index = info.index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.navTitle = info.title
    // TODO implement hidden
    this.hidden = false
    // init empty children, children are added later when traversing the tree
    this.children = []
  }
  *walkBfs(): Generator<Node, void, unknown> {
    for (const child of this.children) {
      yield child
      if (isDirNode(child)) {
        yield* child.walkBfs()
      }
    }
  }
  navigable(): boolean {
    if (!this.hidden && this.navChildren().length > 0) {
      return true
    }
    return false
  }
  navChildren(): NavNode[] {
    return this.children.flatMap((n) => {
      if (isDocNode(n) || isDirNode(n)) {
        if (n.navigable()) {
          return [n]
        } else {
          return []
        }
      } else {
        return []
      }
    })
  }

  addChild(node: Node) {
    this.children.push(node)
  }
}

export class FileMediaNode implements IMediaNode {
  private source: AbstractFileSourceType
  relPath: string
  type: 'media'
  id: DocId
  index: number
  depth: number
  parent?: IDirNode | undefined
  mediaType: MediaType 

  constructor(
    source: AbstractFileSourceType,
    relPath: string,
    index: number,
    parent?: IDirNode | undefined
  ) {
    this.source = source
    this.relPath = relPath
    const info = source.extractTitleVersionIndex(relPath, index, parent)
    this.type = 'media'
    this.id = {
      id: source.buildId(info.title),
      version: info.version,
    }
    this.index = info.index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.mediaType = source.getMediaType(relPath)
  }

  async read(): Promise<ArrayBuffer> {
    const fullPath = this.physicalPath()
    return this.source.readFileRaw(fullPath)
  }

  parents(): IDirNode[] {
    let p: IDirNode[] = []
    let current = this.parent
    while (current) {
      p.push(current)
      current = current.parent
    }
    return p
  }

  physicalPath(): string {
    return this.source.fullFilePath(this.relPath)
  }
}

export abstract class AbstractFileDocNode
  implements IDocNode
{
  protected source: AbstractFileSourceType
  type: 'file'
  relPath: string
  id: DocId
  index: number
  depth: number
  parent?: IDirNode | undefined
  navTitle: string
  hidden: boolean
  title: string
  tags: string[]
  frontmatter: Record<string, any>
  indexDoc: boolean
  isPartial: boolean
  constructor(
    source: AbstractFileSourceType,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    this.source = source
    this.relPath = relPath
    const info = source.extractTitleVersionIndex(relPath, index, parent)
    this.type = 'file'
    this.id = {
      id: source.buildId(this.relPath),
      version: info.version,
    }
    this.index = info.index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.navTitle = info.title
    this.indexDoc = source.isIndexDoc(relPath)
    this.isPartial = source.isPartialPath(relPath)
    this.frontmatter = frontmatter
    // TODO open question: should these be on the parsed doc? or do we need them here?
    this.hidden = frontmatter.hidden || false
    this.title = frontmatter.title || info.title || ''
    this.tags = frontmatter.tags || []
  }
  async read(): Promise<string> {
    const fullPath = this.physicalPath()
    const buffer = await this.source.readFileRaw(fullPath)
    return new TextDecoder('utf-8').decode(buffer)
  }

  parents(): IDirNode[] {
    let p: IDirNode[] = []
    let current = this.parent
    while (current) {
      p.push(current)
      current = current.parent
    }
    return p
  }

  physicalPath(): string {
    return this.source.fullFilePath(this.relPath)
  }

  navigable(): boolean {
    if (this.hidden) {
      return false
    }
    return true
  }

  // left to be implemented by the subclass based on the markdown flavor
  abstract parse(): Promise<IParsedDocNode>
}
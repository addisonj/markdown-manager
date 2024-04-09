import type { ReactNode } from 'react'
import { BaseFileSource } from './file_source'
import {
  IDirNode,
  IDocNode,
  IMediaNode,
  ILoadedDocNode,
  IRenderableDocNode,
  MediaType,
  NavNode,
  Node,
  ReactOptions,
  ReactShape,
  isDirNode,
  isDocNode,
} from './types'
import path from 'path'

export class FileDirNode implements IDirNode {
  relPath: string
  type: 'directory'
  index: number
  depth: number
  parent?: IDirNode | undefined
  navTitle: string
  hidden: boolean
  children: Node[]
  metadata: Record<string, any> = {}
  constructor(
    public source: BaseFileSource,
    relPath: string,
    index: number,
    parent?: IDirNode | undefined
  ) {
    this.relPath = relPath
    this.type = 'directory'
    this.index = index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.navTitle = path.basename(relPath)
    // allow for any enrichment to set hidden to true
    this.hidden = false
    // init empty children, children are added later when traversing the tree
    this.children = []
  }
  /**
   * We make this a getter so that we can defer the computation of the webUrl
   * until we know that children have been added to the node
   */
  get webUrl(): string | undefined {
    const url = this.source.extractUrl(this)
    if (!url) {
      return undefined
    }
    return path.normalize(url)
  }
  *walkBfs(): Generator<Node, void, unknown> {
    for (const child of this.children) {
      yield child
      if (isDirNode(child)) {
        yield* child.walkBfs()
      }
    }
  }
  hasChildIndexDoc(): boolean {
    for (const n of this.navChildren()) {
      if (isDocNode(n) && n.indexDoc) {
        return true
      }
    }
    return false
  }
  navigable(): boolean {
    if (!this.hidden && this.hasChildIndexDoc()) {
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

  asJSON(): any {
    const children = this.children.map((c) => c.asJSON())
    return {
      type: 'directory',
      relPath: this.relPath,
      index: this.index,
      depth: this.depth,
      navTitle: this.navTitle,
      hidden: this.hidden,
      metadata: this.metadata,
      sourceName: this.source.sourceName,
      parent: this.parent ? this.parent.relPath : undefined,
      children,
    }
  }

  dedupeId(): string {
    return path.join(this.source.sourceRoot, this.relPath)
  }

  merge(other: IDirNode): void {
    const idx: Record<string, Node> = {}
    // just add children first to the idx map so we can dedupe
    for (const child of this.children) {
      idx[child.dedupeId()] = child
    }
    for (const child of other.children) {
      if (idx[child.dedupeId()]) {
        const existing = idx[child.dedupeId()]
        existing.merge(child)
      } else {
        this.addChild(child)
      }
    }
  }
}

export class FileMediaNode implements IMediaNode {
  source: BaseFileSource
  relPath: string
  type: 'media'
  index: number
  depth: number
  parent?: IDirNode | undefined
  mediaType: MediaType
  metadata: Record<string, any> = {}

  constructor(
    source: BaseFileSource,
    relPath: string,
    index: number,
    parent?: IDirNode | undefined
  ) {
    this.source = source
    this.relPath = relPath
    this.type = 'media'
    this.index = index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.mediaType = source.getMediaType(relPath)
  }

  /**
   * We make this a getter so that we can defer the computation of the webUrl
   * in the event that some extractors have added changed the node and the user wants to use
   * that metadata
   */
  get webUrl(): string {
    return path.normalize(this.source.extractUrl(this) || this.relPath)
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
    return this.source.ensureFullFilePath(this.relPath)
  }

  dedupeId(): string {
    return path.join(this.source.sourceRoot, this.relPath)
  }

  merge(other: IMediaNode): void {
    this.metadata = { ...this.metadata, ...other.metadata }
  }
  asJSON() {
    return {
      type: 'media',
      relPath: this.relPath,
      index: this.index,
      depth: this.depth,
      metadata: this.metadata,
      mediaType: this.mediaType,
      sourceName: this.source.sourceName,
      parent: this.parent ? this.parent.relPath : undefined,
    }
  }
}

export abstract class AbstractFileDocNode
  implements IDocNode, IRenderableDocNode
{
  source: BaseFileSource
  type: 'file'
  relPath: string
  index: number
  depth: number
  parent?: IDirNode | undefined
  navTitle: string
  hidden: boolean
  title: string
  tags: string[]
  frontmatter: Record<string, any>
  indexDoc: boolean
  abstract providerName: string
  metadata: Record<string, any> = {}
  constructor(
    source: BaseFileSource,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    this.source = source
    this.relPath = relPath
    this.type = 'file'
    const title = frontmatter.title || path.basename(relPath, path.extname(relPath))
    this.index = index
    this.depth = parent ? parent.depth + 1 : 0
    this.parent = parent
    this.title = title 
    this.navTitle = frontmatter.navTitle || title
    this.indexDoc = source.isIndexDoc(relPath)
    this.frontmatter = frontmatter
    this.hidden = frontmatter.hidden || false
    this.tags = frontmatter.tags || []
  }

  /**
   * We make this a getter so that we can defer the computation of the webUrl
   * in the event that some extractors have added changed the node and the user wants to use
   * that metadata
   */
  get webUrl(): string {
    return path.normalize(this.source.extractUrl(this) || this.relPath)
  }

  async rawContent(): Promise<string> {
    return this.read()
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
    return this.source.ensureFullFilePath(this.relPath)
  }

  navigable(): boolean {
    if (this.hidden) {
      return false
    }
    return true
  }

  dedupeId(): string {
    return path.join(this.source.sourceRoot, this.relPath)
  }

  merge(other: IDocNode): void {
    throw new Error('Cannot merge doc nodes, likely a misconfiguration!')
  }

  asJSON() {
    return {
      type: 'file',
      relPath: this.relPath,
      title: this.title,
      navTitle: this.navTitle,
      indexDoc: this.indexDoc,
      frontmatter: this.frontmatter,
      tags: this.tags,
      metadata: this.metadata,
      index: this.index,
      depth: this.depth,
      sourceName: this.source.sourceName,
      parent: this.parent ? this.parent.relPath : undefined,
    }
  }

  // left to be implemented by the subclass based on the markdown flavor
  abstract load(): Promise<ILoadedDocNode>

  abstract renderTarget: 'html' | 'react' | 'other'
  // stub implementations, with the expectation that the subclass will override the render method they need
  async renderReact(react: ReactShape, opts: ReactOptions): Promise<ReactNode> {
    throw new Error('Method not implemented.')
  }
  async renderHtml(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async renderOther(...args: any[]): Promise<any> {
    throw new Error('Method not implemented.')
  }
}

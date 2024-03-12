import type { ReactNode } from 'react'
import { ValidationError } from './validator'
/**
 * Represents an id, which have may multiple version
 */
export type DocId = {
  id: string
  version: string
}

/**
 * Represents the root of the tree, with some convenience methods for interacting with the tree
 */
export type IDocTree = {
  children: Node[]
  navChildren(): NavNode[]
  getMediaNodes: () => Promise<IMediaNode[]>
  walkBfs(): Generator<Node, void, unknown>
}

export type NodeTypes = 'directory' | 'file' | 'media'
/**
 * The base node that the tree of content extends from
 */
export type Node = {
  readonly type: NodeTypes
  /**
   * The relative path to the node from the root of the tree
   */
  readonly relPath: string
  /**
   * The unique identifier for the node, used in URLs/paths
   */
  readonly id: DocId
  /**
   * The index used in determining the order of files
   */
  readonly index: number

  /**
   * How deep the node is in the tree
   */
  readonly depth: number

  /**
   * the parent node, if null, then this node is a root, otherwise
   * it must belong to a directory
   */
  readonly parent?: IDirNode
}

export type NavNode = Node & {
  /**
   * The title used in navigation menus
   */
  readonly navTitle: string

  /**
   * Indicates that an item is hidden in a node
   */
  readonly hidden: boolean

  /**
   * Indicates if an item should build a "link"
   */
  navigable(): boolean

  /**
   * TODO determine if this lives here?
   *
   * used to determine if a link should belong here
   */
  //buildRelativeLink: (meta: Record<string, any>) => Promise<string>
}
/**
 * Represents a "directory" node in the meta data, used to group files
 *
 */
export type IDirNode = NavNode & {
  readonly type: 'directory'

  readonly children: Node[]

  walkBfs(): Generator<Node, void, unknown>
  /**
   * Only the navigable children, i.e. those that should be in the UI
   */
  navChildren(): NavNode[]
}

/**
 * Represents a "document" node in the meta data, used to represent a file
 * This is used *before* the document is parsed, so it only has a subset of the data
 * but the file *is* opened
 */
export type IDocNode = NavNode & {
  readonly type: 'file'

  /**
   * The title from the frontmatter
   */
  readonly title: string

  /**
   * Any user/automatically generated tags for the document
   */
  readonly tags: string[]

  /**
   * key value pairs of frontmatter data for the document
   */
  readonly frontmatter: Record<string, any>

  /**
   * Indicates if document is an "index", i.e. the default document for a directory
   */
  readonly indexDoc: boolean

  /**
   * Indicates that this document is a "partial" document, not intended to produce a whole
   * page but instead a section of content
   */
  readonly isPartial: boolean

  /**
   * The raw content of the document, with frontmatter removed
   */
  read: () => Promise<string>

  /**
   *
   * @returns the full path to the document (on disk/remote location) *not* the path for rendering
   */
  physicalPath: () => string

  /**
   *
   * @returns the parsed version of the document
   */
  parse(): Promise<IParsedDocNode>

  /**
   *
   * @returns the list of parents up the root of the tree
   */
  parents: () => IDirNode[]
}

export type RenderableDoc = string | ((props: any) => ReactNode) | ((props: any) => string)
export type IParsedDocNode = Omit<IDocNode, 'parse'> & {
  /**
   * the parsed AST of the document
   */
  ast(): any

  /**
   *
   * @returns the links in the document
   */
  links: () => OutLink[]

  localLinks: () => OutLink[]

  renderTarget: 'html' | 'react' | 'other'

  /**
   * Returns either the document or a JSX/react element for rendering the document
   */
  render(): Promise<RenderableDoc>

  /**
   * Returns the document as a string of *vanilla* markdown, with any special syntax removed
   */
  asMarkdown(): Promise<string>
}

export type DocFileType =
  | 'markdown'
  | 'image'
  | 'video'
  | 'document'
  | 'unknown'
export type MediaType = Omit<DocFileType, 'markdown'>
/**
 * Represents a "media" node in the meta data, used to represent a non-textual resource (image, video, etc)
 * This is used *before* the document is parsed, so it only has a subset of the data
 */
export type IMediaNode = Node & {
  readonly type: 'media'
  readonly mediaType: MediaType

  /**
   * The raw content of the document, with frontmatter removed
   */
  read: () => Promise<ArrayBuffer>

  /**
   *
   * @returns the full path to the document (on disk/remote location) *not* the path for rendering
   */
  physicalPath: () => string

  /**
   *
   * @returns the parent directory of the document
   */
  parents: () => IDirNode[]
}

export type OutLinkType =
  | 'external' // A link to an external resource
  | 'anchor' // A link to an anchor in the same document
  | 'id' // A link to a document by its id
  | 'absolute' // A link to an absolute path in the same site
  | 'relative' // A link to a relative path in the same site

/**
 * Represents a link in a document to another resource
 */
export type OutLink = {
  readonly type: OutLinkType
  readonly rawValue: string
  readonly title: string
}

export type DocFragment = {
  readonly id: string
  readonly title: string
}

export type DocProvider<DN extends IDocNode> = {
  readonly name: string

  /**
   * Creates the IDocNode for a physical file
   * @param source the source of the file
   * @param fullPath the path to the file
   * @param index the index of the file in the directory
   * @param parent the parent dir node, if empty, then the file is a root
   * @returns
   */
  buildDocNode: (
    source: IDocSource<DN, DocProvider<DN>>,
    fullPath: string,
    index: number,
    parent?: IDirNode
  ) => Promise<DN>
}

export type IDocSource<DN extends IDocNode, P extends DocProvider<DN>> = {
  readonly sourceRoot: string
  readonly provider: P
  readonly sourceType: string
  buildTree: () => Promise<IDocTree>
}

// Type guard for IDirNode
export function isDirNode(node: any): node is IDirNode {
  return node.type === 'directory'
}

// Type guard for IDocNode
export function isDocNode<ASTType, LinkType extends OutLink>(
  node: any
): node is IDocNode {
  return node.type === 'file'
}

// Type guard for IMediaNode
export function isMediaNode(node: any): node is IMediaNode {
  return node.type === 'media'
}

/**
 * Represents a location in a document
 */
export type DocLocation = {
  source: string
  start?: {
    line: number
    character: number
  }
  end?: {
    line: number
    character: number
  }
}

export type IDocRepo = {
  docs(): Promise<IParsedDocNode[]>
  /**
   * returns one or more docs. If the doc has multiple versions, all will be returned unless a version is specified
   * @param id the id doc
   * @param version an optional version
   */
  doc(id: string, version?: string): Promise<IParsedDocNode[]>
  media(): Promise<IMediaNode[]>
  mediaItem(id: string): Promise<IMediaNode>

  validate(): Promise<ValidationError[]>

  walkBfs(): Generator<Node, void, unknown> 
}

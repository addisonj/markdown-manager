import type { ReactNode, createElement, Fragment } from 'react'
import { ValidationError } from './validator'
import { SourceConfig } from './config'
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
  source: IDocSource
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
   * A name of the provider of the document, allows for callers to know 
   * what type of docNode and how to handle it
   */
  readonly providerName: string

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

export type ReactShape = Readonly<{
  createElement: typeof createElement
  Fragment: typeof Fragment
}>
export type ComponentRepo = Record<string, React.ComponentType<any>> 
export type ReactOptions = {
  components?: ComponentRepo 
} & Record<string, any>
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

  /**
   * The target for rendering the document, depending on the return type of this, call the matching render function!
   */
  renderTarget: 'html' | 'react' | 'other'

  /**
   * 
   * @param react a react implementation
   * @param opts opts, primarily, a component repo for any components that may be needed
   * @returns A react node which can render the document
   */
  renderReact: (react: ReactShape, opts: ReactOptions ) => Promise<ReactNode>

  /**
   * Render to a string
   */
  renderHtml(): Promise<string>

  /**
   * Implementation specific rendering function, the caller needs to know what 
   * the required arguments and return types
   * @param args any arguments needed to render the document
   */
  renderOther(...args: any[]): Promise<any>

  /**
   * Returns the document as a string of *vanilla* markdown, with any special syntax removed
   */
  asMarkdown(): Promise<string>
}

export type IRenderableDocNode = Pick<IParsedDocNode, 'renderTarget' | 'renderReact' | 'renderHtml' | 'renderOther'>

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

export type DocProvider = {
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
    source: IDocSource,
    fullPath: string,
    index: number,
    parent?: IDirNode
  ) => Promise<IDocNode>
}

export type IDocSource = {
  readonly config: SourceConfig
  readonly sourceRoot: string
  readonly provider: DocProvider
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
  repoName: string
  docs(): Promise<IDocNode[]>
  /**
   * returns one or more docs. If the doc has multiple versions, all will be returned unless a version is specified
   * @param id the id doc
   * @param version an optional version
   */
  doc(id: string, version?: string): Promise<IDocNode[]>
  media(): Promise<IMediaNode[]>
  mediaItem(id: string, version?: string): Promise<IMediaNode[]>

  validate(): Promise<ValidationError[]>

  walkBfs(): Generator<Node, void, unknown>
}

import type { Fragment, ReactNode, createElement } from 'react'
import { SourceConfig } from './config'
import { IEnrichment } from './enrichment'
import { Extraction, IExtractor } from './extractor'
import { IValidator, ValidationError } from './validator'

/**
 * Uniquely identifies a document with the path and version
 * As we may have  multiple versions at the same path, we need the version to uniquely identify a document
 *
 */
export type PathDocId = {
  path: string
  version: string
}

/**
 * Represents the root of the tree, with some convenience methods for interacting with the tree
 */
export type IDocTree = {
  version: string,
  source: IDocSource
  children: Node[]
  navChildren(): NavNode[]
  getMediaNodes: () => Promise<IMediaNode[]>
  walkBfs(): Generator<Node, void, unknown>
  asJSON(): any
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
   * The index used in determining the order of files
   */
  index: number

  /**
   * How deep the node is in the tree
   */
  readonly depth: number

  /**
   * the parent node, if null, then this node is a root, otherwise
   * it must belong to a directory
   */
  readonly parent?: IDirNode

  /**
   * A bag of metadata properties to be used by enrichments and other plugins to add metadata
   */
  readonly metadata: Record<string, any>

  /**
   * The source that created the node
   */
  readonly source: IDocSource

  /**
   * Serialize the node to JSON, primarily used for debugging 
   */
  asJSON(): any 

}

export type NavNode = Node & {
  /**
   * The title used in navigation menus
   */
  navTitle: string

  /**
   * Indicates that an item is hidden in a node
   */
  hidden: boolean

  /**
   * Indicates if an item should build a "link"
   */
  navigable(): boolean
}

/**
 * Represents a "directory" node in the meta data, used to group files
 *
 */
export type IDirNode = NavNode & {
  readonly type: 'directory'

  readonly children: Node[]

  /**
   * 
   * @param node adds a child to the directory
   */
  addChild(node: Node): void

  /**
   * Allow to navigate to the "directory", typically used when a directory has an index node
   */
  webUrl?: string

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
   * The web url for the document where it will be available at
   */
  webUrl: string

  /**
   * A name of the provider of the document, allows for callers to know
   * what type of docNode and how to handle it
   */
  readonly providerName: string

  /**
   * The title from the frontmatter
   */
  title: string

  /**
   * Any user/automatically generated tags for the document
   */
  tags: string[]

  /**
   * key value pairs of frontmatter data for the document
   */
  readonly frontmatter: Record<string, any>

  /**
   * Indicates if document is an "index", i.e. the default document for a directory
   */
  indexDoc: boolean

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
   * @returns loads the document
   */
  load(): Promise<ILoadedDocNode>

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
export type ILoadedDocNode = Omit<IDocNode, 'load'> & {
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
  renderReact: (react: ReactShape, opts: ReactOptions) => Promise<ReactNode>

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

export type IRenderableDocNode = Pick<
  ILoadedDocNode,
  'renderTarget' | 'renderReact' | 'renderHtml' | 'renderOther'
>

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
  mediaType: MediaType
  webUrl: string

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

  assembleTree?: (source: IDocSource, rootChildren: Node[]) => Promise<IDocTree>

  defaultExtractors: () => IExtractor[]
  defaultValidators: () => IValidator[]
  defaultEnrichments: () => IEnrichment[]
}

export type IDocSource = {
  readonly config: SourceConfig
  readonly sourceRoot: string
  readonly provider: DocProvider
  readonly sourceType: string
  enrichments: IEnrichment[]
  buildTree: () => Promise<IDocTree>
  defaultExtractors: () => IExtractor[]
  defaultValidators: () => IValidator[]
  defaultEnrichments: () => IEnrichment[]
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
  /**
   * returns all docs in the repo
   */
  docs(): Promise<IDocNode[]>
  /**
   * returns one or more docs by the path on disk
   * @param path the path to the doc
   * @param version an optional version
   */
  docByPath(path: string): Promise<IDocNode[]>


  /**
   * Return one or more documents by the URL
   * @param url the url of the document
   */
  docByUrl(url: string): Promise<IDocNode[]>

  /**
   * returns all media in the repo
   */
  media(): Promise<IMediaNode[]>

  /**
   * Returns one or more media items
   * @param path the path to the media
   * @param version the version of the media
   */
  mediaItemByPath(path: string): Promise<IMediaNode[]>

  /**
   * Run *all* configured extractors and return any extracted data, with the key being the name
   * of the extractor and the record being the extracted data
   *
   * For more control, use the extractSet method which allows for a specific set of extractors to be run
   */
  extract(): Promise<Extraction[]>

  /**
   * Run the configured extractors and return any extracted data, with the key being the name of the extractor
   *
   * @param extractors a set of extractors to run
   */
  extractSet(extractors: IExtractor[]): Promise<Extraction[]>

  /**
   * Run *all* configured validators and return any errors
   *
   * For more control, use validateSet which allows for a specific set of validators to be run
   */
  validate(): Promise<ValidationError[]>

  /**
   * Run the configured validators and return any errors
   *
   * Useful for when you want to run some subset of validation (like validators that should fail a build or validators that don't load documents)
   * @param validators a set of validators to run
   */
  validateSet(validators: IValidator[]): Promise<ValidationError[]>

  /**
   * The list of configured extractors
   */
  extractors: IExtractor[]
  /**
   * The list of configured validators
   */
  validators: IValidator[]

  /**
   * Allows for walking all the nodes in the tree, intended for use by validators / extractors, etc
   * to perform operations over all documents
   */
  walkBfs(): Generator<Node, void, unknown>

  /**
   * Access the tree of documents
   */
  tree(): Promise<IDocTree>
}

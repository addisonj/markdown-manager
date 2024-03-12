import {
  AbstractFileDocNode,
  AbstractFileSourceType,
  DocProvider,
  IDirNode,
  IDocSource,
  IParsedDocNode,
  OutLink,
  OutLinkType,
  RenderableDoc,
} from '../core'
import { extractLinks } from './helpers'
import { Node as MDNode, parse, Location as MDLocation } from '@markdoc/markdoc'

// TODO figure this out...
export class MarkdocLink implements OutLink {
  constructor(
    public type: OutLinkType,
    public rawValue: string,
    public title: string,
    public location: MDLocation | undefined
  ) {}
}

export class MarkdocDocNode
  extends AbstractFileDocNode
  implements IParsedDocNode
{
  private _ast: MDNode | undefined
  private linkCache: MarkdocLink[] | undefined
  renderTarget: 'html' | 'react' | 'other' = 'react'
  ast(): MDNode {
    if (!this._ast) {
      throw new Error('AST not parsed')
    }
    return this._ast
  }
  constructor(
    source: AbstractFileSourceType,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    super(source, relPath, index, frontmatter, parent)
  }
  render(): Promise<RenderableDoc> {
    throw new Error('Method not implemented.')
  }
  asMarkdown(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async parse(): Promise<MarkdocDocNode> {
    if (this._ast) {
      return Promise.resolve(this)
    }
    const contents = await this.source.readFileRaw(this.physicalPath())
    const decoder = new TextDecoder('utf-8')
    const decoded = decoder.decode(contents)
    this._ast = parse(decoded)
    this.linkCache = extractLinks(this.physicalPath(), this._ast)
    return Promise.resolve(this)
  }
  links(): MarkdocLink[] {
    if (!this.linkCache) {
      throw new Error('AST not parsed')
    }
    return this.linkCache
  }
  localLinks(): MarkdocLink[] {
    if (!this.linkCache) {
      throw new Error('AST not parsed')
    }
    return this.linkCache.filter((l) => l.type !== 'external')
  }
}

export class MarkdocFileProvider
  implements DocProvider<MarkdocDocNode>
{
  constructor() {}
  async buildDocNode(
    source: IDocSource<
      MarkdocDocNode,
      DocProvider<MarkdocDocNode>
    >,
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<MarkdocDocNode> {
    if (source.sourceType !== 'file') {
      throw new Error('MarkdocFileProvider only supports file sources')
    }
    const castSource = source as AbstractFileSourceType
    const frontmatter = await castSource.extractMarkdownMetadata(fullPath)
    return Promise.resolve(
      new MarkdocDocNode(castSource, fullPath, index, frontmatter, parent)
    )
  }
  name: string = 'markdoc-file'
}

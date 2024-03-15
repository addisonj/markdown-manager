import { evaluate } from '@mdx-js/mdx'
import type { ReactNode } from 'react'
import {
  AbstractFileDocNode,
  BaseFileSource,
  DocProvider,
  IDirNode,
  IDocSource,
  IParsedDocNode,
  OutLink,
  ReactOptions,
  ReactShape,
  SourceConfig,
} from '../core'

export class MdxDocNode extends AbstractFileDocNode implements IParsedDocNode {
  providerName: string = 'mdx-file'
  private _ast: string | undefined
  private linkCache: OutLink[] | undefined
  renderTarget: 'html' | 'react' | 'other' = 'react'
  ast(): string {
    if (!this._ast) {
      throw new Error('AST not parsed')
    }
    return this._ast
  }
  constructor(
    source: BaseFileSource,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    super(source, relPath, index, frontmatter, parent)
  }
  async renderReact(react: ReactShape, opts: ReactOptions): Promise<ReactNode> {
    const mdx = await evaluate(this.ast(), {
      Fragment: react.Fragment,
    })
    return mdx.default(opts)
  }
  asMarkdown(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async parse(): Promise<MdxDocNode> {
    if (this._ast) {
      return Promise.resolve(this)
    }
    const contents = await this.source.readFileRaw(this.physicalPath())
    const decoder = new TextDecoder('utf-8')
    const decoded = decoder.decode(contents)
    this._ast = decoded
    // TODO figure out how to extract links!
    this.linkCache = []
    return Promise.resolve(this)
  }
  links(): OutLink[] {
    if (!this.linkCache) {
      throw new Error('AST not parsed')
    }
    return this.linkCache
  }
  localLinks(): OutLink[] {
    if (!this.linkCache) {
      throw new Error('AST not parsed')
    }
    return this.linkCache.filter((l) => l.type !== 'external')
  }
}

export class MdxFileProvider implements DocProvider {
  constructor() {}
  async buildDocNode(
    source: IDocSource,
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<MdxDocNode> {
    if (source.sourceType !== 'file') {
      throw new Error('MarkdocFileProvider only supports file sources')
    }
    const castSource = source as BaseFileSource
    const frontmatter = await castSource.extractMarkdownMetadata(fullPath)
    return Promise.resolve(
      new MdxDocNode(castSource, fullPath, index, frontmatter, parent)
    )
  }
  static async buildProvider(config: SourceConfig): Promise<DocProvider> {
    return new MdxFileProvider()
  }
  name: string = 'mdx-file'
}

import admonitionPlugin from '@docusaurus/mdx-loader/lib/remark/admonitions'
import { evaluate } from '@mdx-js/mdx'
import type { ReactNode } from 'react'
import directivePlugin from 'remark-directive'
import remarkGfm from 'remark-gfm'
import {
  AbstractFileDocNode,
  BaseFileSource,
  DocProvider,
  IDirNode,
  IDocSource,
  IDocTree,
  IExtractor,
  ILoadedDocNode,
  IValidator,
  MdxOptions,
  Node,
  OutLink,
  ReactOptions,
  ReactShape,
  SourceConfig,
  isMdxOptions,
} from '../core'
import { IEnrichment } from '../core/enrichment'
import frontmatterPlugin from 'remark-frontmatter'
import { EvaluateOptions } from '@mdx-js/mdx/lib/util/resolve-evaluate-options'

export class MdxDocNode extends AbstractFileDocNode implements ILoadedDocNode {
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
    private mdxOptions: Required<MdxOptions>,
    source: BaseFileSource,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    super(source, relPath, index, frontmatter, parent)
  }
  async renderReact(react: ReactShape, opts: ReactOptions): Promise<ReactNode> {
    const {baseUrl, ...other} = this.mdxOptions
    const format = this.relPath.endsWith('.mdx') ? 'mdx' : 'md'
    const allOptions: EvaluateOptions = {
      ...other,
      format,
      Fragment: react.Fragment,
      jsx: react.createElement,
      jsxs: react.createElement,
      useMDXComponents: () => opts.components || {},
    }
    if (baseUrl) {
      allOptions.baseUrl = baseUrl
    }
    const mdx = await evaluate(this.ast(), allOptions)
    return mdx.default(opts)
  }
  asMarkdown(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async load(): Promise<MdxDocNode> {
    if (this._ast) {
      return Promise.resolve(this)
    }
    const contents = await this.source.readFileRaw(this.physicalPath())
    const decoder = new TextDecoder('utf-8')
    const decoded = decoder.decode(contents)
    this._ast = decoded
    // TODO figure out how to extract links!
    this.linkCache = []
    return this
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
export const DefaultMdxOptions: Required<MdxOptions> = {
  type: 'mdx',
  baseUrl: '',
  docusaurusCompatible: false,
  remarkPlugins: [frontmatterPlugin],
  rehypePlugins: [],
  recmaPlugins: [],
  customizeMDXConfig: function (config: EvaluateOptions): EvaluateOptions {
    return config
  },
}

export const DocusaurusOptions: Required<Pick<MdxOptions, 'remarkPlugins'>> = {
  remarkPlugins: [directivePlugin, admonitionPlugin.default, remarkGfm],
}

export class MdxFileProvider implements DocProvider {
  constructor(private mdxOptions: Required<MdxOptions>) {}
  assembleTree?:
    | ((source: IDocSource, rootChildren: Node[]) => Promise<IDocTree>)
    | undefined
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
    const relPath = castSource.ensureRelPath(fullPath)
    return Promise.resolve(
      new MdxDocNode(
        this.mdxOptions,
        castSource,
        relPath,
        index,
        frontmatter,
        parent
      )
    )
  }
  static async buildProvider(config: SourceConfig): Promise<DocProvider> {
    const markdownOptions = config.markdownOptions
    let markdocOpts: Required<MdxOptions> = DefaultMdxOptions
    if (markdownOptions && isMdxOptions(markdownOptions)) {
      const { recmaPlugins, remarkPlugins, rehypePlugins, ...restOpts } =
        markdocOpts
      const {
        recmaPlugins: addRecmaPlugins,
        remarkPlugins: addRemarkPlugins,
        rehypePlugins: addRehypePlugins,
        ...addRestOpts
      } = markdownOptions
      if (markdownOptions.docusaurusCompatible) {
        remarkPlugins.push(...DocusaurusOptions.remarkPlugins)
      }
      if (addRemarkPlugins) {
        remarkPlugins.push(...addRemarkPlugins)
      }
      if (addRehypePlugins) {
        rehypePlugins.push(...addRehypePlugins)
      }
      if (addRecmaPlugins) {
        recmaPlugins.push(...addRecmaPlugins)
      }
      markdocOpts = {
        recmaPlugins,
        remarkPlugins,
        rehypePlugins,
        ...restOpts,
        ...addRestOpts,
      }
    }
    return new MdxFileProvider(markdocOpts)
  }
  defaultExtractors(): IExtractor[] {
    return []
  }
  defaultValidators(): IValidator[] {
    return []
  }
  defaultEnrichments(): IEnrichment[] {
    return []
  }
  name: string = 'mdx-file'
}

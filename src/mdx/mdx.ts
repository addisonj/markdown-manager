import admonitionPlugin from '@docusaurus/mdx-loader/lib/remark/admonitions'
// TODO this plugin is causing compile errors downstream
//import docusaurusHeaderPlugin from '@docusaurus/mdx-loader/lib/remark/headings'
import { CompileOptions, RunOptions, compile, run } from '@mdx-js/mdx'
import { EvaluateOptions } from '@mdx-js/mdx/lib/util/resolve-evaluate-options'
import type { ReactNode } from 'react'
import rehypeSlug from 'rehype-slug'
import directivePlugin from 'remark-directive'
import emojiPlugin from 'remark-emoji'
import frontmatterPlugin from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import {
  AbstractFileDocNode,
  BaseFileSource,
  DocIndex,
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
import { ContentTitlePlugin } from './mdxPlugins/content_title'
import { SearchIndexPlugin } from './mdxPlugins/search_index'
import { VFile } from 'vfile'

export class MdxDocNode extends AbstractFileDocNode implements ILoadedDocNode {
  providerName: string = 'mdx-file'
  private _ast: VFile | undefined
  private searchIndex: DocIndex | undefined
  private linkCache: OutLink[] | undefined
  renderTarget: 'html' | 'react' | 'other' = 'react'
  ast(): VFile {
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
    const { baseUrl, ...other } = this.mdxOptions
    const runOptions: RunOptions = {
      ...other,
      Fragment: react.Fragment,
      jsx: react.createElement,
      jsxs: react.createElement,
      useMDXComponents: () => opts.components || {},
    }
    if (baseUrl) {
      runOptions.baseUrl = baseUrl
    }
    const ast = this.ast()
    try {
      const mdx = await run(ast, runOptions)
      return mdx.default(opts)
    } catch (ex: any) {
      throw new Error(`Error rendering MDX in ${this.relPath}: ${ex.message}`)
    }
  }
  async load(): Promise<MdxDocNode> {
    if (this._ast) {
      return Promise.resolve(this)
    }
    const contents = await this.read()
    const textVFile: VFile = new VFile({
      value: contents,
      path: this.physicalPath(),
      // pass the node to the vfile so we can access it later in plugins
      data: {
        node: this,
      },
    })

    const { baseUrl, ...other } = this.mdxOptions
    const format = this.relPath.endsWith('.mdx') ? 'mdx' : 'md'
    const compileOpts: CompileOptions = {
      ...other,
      format,
      // NOTE! critical for getting the generated
      // code to have the right output
      providerImportSource: '#',
      outputFormat: 'function-body',
    }
    try {
      this._ast = await compile(textVFile, compileOpts)
    } catch (ex: any) {
      throw new Error(`Error compiling MDX in ${this.relPath}: ${ex.message}`)
    }
    // TODO figure out how to extract links!
    if (this._ast.data.links) {
      this.linkCache = this._ast.data.links as OutLink[]
    }
    if (this._ast.data.searchIndex) {
      this.searchIndex = this._ast.data.searchIndex as DocIndex
    } else {
      // compute a "fallback" search index that just has the title
      this.searchIndex = {
        title: this.title,
        tags: this.tags,
        metadata: this.metadata,
        frontmatter: this.frontmatter,
        description: this.frontmatter.description,
        webUrl: this.webUrl,
        sections: [],
      }
    }
    // if we have a title from frontmatter, use that, but otherwise, use the content title
    if (this._ast.data.contentTitle) {
      this.title =
        this.frontmatter.title || (this._ast.data.contentTitle as string)
    }

    return this
  }
  links(): OutLink[] {
    if (!this._ast) {
      throw new Error('AST not parsed')
    }
    // if links can't be extracted, return an empty array
    if (!this.linkCache) {
      return []
    }
    return this.linkCache
  }
  localLinks(): OutLink[] {
    return this.links().filter((l) => l.type !== 'external')
  }
  async extractIndex(): Promise<DocIndex> {
    if (!this._ast) {
      throw new Error('AST not parsed')
    }
    if (!this.searchIndex) {
      throw new Error('Search index not extracted')
    }
    return this.searchIndex
  }
}
export const DefaultMdxOptions: Required<MdxOptions> = {
  type: 'mdx',
  baseUrl: '',
  docusaurusCompatible: false,
  remarkPlugins: [
    frontmatterPlugin,
    [remarkMdxFrontmatter, { name: 'matter' }],
    ContentTitlePlugin,
    emojiPlugin,
    rehypeSlug,
  ],
  rehypePlugins: [],
  recmaPlugins: [],
  customizeMDXConfig: function (config: EvaluateOptions): EvaluateOptions {
    return config
  },
}

export const DocusaurusOptions: Required<Pick<MdxOptions, 'remarkPlugins'>> = {
  remarkPlugins: [
    frontmatterPlugin,
    [remarkMdxFrontmatter, { name: 'matter' }],
    ContentTitlePlugin,
    emojiPlugin,
    //docusaurusHeaderPlugin,
    directivePlugin,
    admonitionPlugin.default,
    remarkGfm,
    SearchIndexPlugin,
  ],
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
      let { recmaPlugins, remarkPlugins, rehypePlugins, ...restOpts } =
        markdocOpts
      const {
        recmaPlugins: addRecmaPlugins,
        remarkPlugins: addRemarkPlugins,
        rehypePlugins: addRehypePlugins,
        ...addRestOpts
      } = markdownOptions
      // when docusaurusCompatible is true, we use the docusaurus plugins
      // and don't use the default plugins as some of them conflict
      if (markdownOptions.docusaurusCompatible) {
        remarkPlugins = DocusaurusOptions.remarkPlugins
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

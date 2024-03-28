import {
  Config as MDConfig,
  Location as MDLocation,
  Node as MDNode,
  parse,
  renderers,
  transform,
} from '@markdoc/markdoc'
import type { ReactNode } from 'react'
import {
  AbstractFileDocNode,
  BaseFileSource,
  DocProvider,
  IDirNode,
  IDocSource,
  IExtractor,
  ILoadedDocNode,
  IValidator,
  LoggingApi,
  MarkdocOptions,
  OutLink,
  OutLinkType,
  ReactOptions,
  ReactShape,
  SourceConfig,
  getLogger,
  isMarkdocOptions,
} from '../core'
import { IEnrichment } from '../core/enrichment'
import { extractLinks } from './helpers'

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
  implements ILoadedDocNode
{
  private _ast: MDNode | undefined
  private linkCache: MarkdocLink[] | undefined
  renderTarget: 'html' | 'react' | 'other' = 'react'
  providerName: string = 'markdoc-file'
  ast(): MDNode {
    if (!this._ast) {
      throw new Error('AST not parsed')
    }
    return this._ast
  }
  constructor(
    private provider: MarkdocFileProvider,
    source: BaseFileSource,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined,
    public isPartial: boolean = false
  ) {
    super(source, relPath, index, frontmatter, parent)
  }
  async renderReact(react: ReactShape, opts: ReactOptions): Promise<ReactNode> {
    const config = await this.provider.markdownConfig()
    const tree = transform(this.ast(), config)
    console.log('tree', tree)
    return renderers.react(tree, react, opts)
  }
  asMarkdown(): Promise<string> {
    // traverse the AST and convert it back to markdown
    // where we skip any tags that are not native markdown
    // but we do include the content inside the tags
    // TODO finish this later
    throw new Error('Method not implemented.')
  }
  async load(): Promise<MarkdocDocNode> {
    if (this._ast) {
      return Promise.resolve(this)
    }
    const contents = await this.source.readFileRaw(this.physicalPath())
    const decoder = new TextDecoder('utf-8')
    const decoded = decoder.decode(contents)
    this._ast = parse(decoded)
    this.linkCache = extractLinks(this.physicalPath(), this._ast)
    return this
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

export const DefaultMarkdocOptions: Required<MarkdocOptions> = {
  type: 'markdoc',
  async buildSchema() {
    return {} as MDConfig
  },
  partialHints: ['.partial.', '/partials/'],
  partials: {},
}
export class MarkdocFileProvider implements DocProvider {
  private source: IDocSource | undefined
  private mdConfig: MDConfig
  private partialCache: Record<string, MDNode> | undefined
  private logger: LoggingApi
  /**
   * 
   * @param sourceConfig the full source config
   * @param markdocConfig the "resolved" markdoc config if any
   * @param markdocOptions our mini options for markdoc
   */
  private constructor(
    public sourceConfig: SourceConfig,
    public markdocConfig: MDConfig,
    private providerConfig: Required<MarkdocOptions>
  ) {
    this.logger = getLogger().child({ module: 'markdoc-file' })
    this.mdConfig = markdocConfig
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

  async buildDocNode(
    source: IDocSource,
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<MarkdocDocNode> {
    if (source.sourceType !== 'file') {
      throw new Error('MarkdocFileProvider only supports file sources')
    }
    // cache the source
    if (!this.source) {
      this.source = source
    }
    const castSource = source as BaseFileSource
    const frontmatter = await castSource.extractMarkdownMetadata(fullPath)
    const relPath = castSource.ensureRelPath(fullPath)
    const isPartial =
      this.isPartialPath(fullPath) || frontmatter.partial || false
    return Promise.resolve(
      new MarkdocDocNode(
        this,
        castSource,
        relPath,
        index,
        frontmatter,
        parent,
        isPartial
      )
    )
  }
  name: string = 'markdoc-file'

  async markdownConfig(): Promise<MDConfig> {
    const foundPartials = await this.gatherPartials()
    const allPartials = {
      ...this.providerConfig.partials,
      ...foundPartials,
    }

    return {
      ...this.mdConfig,
      partials: allPartials,
    }
  }
  async gatherPartials(): Promise<Record<string, MDNode>> {
    if (this.partialCache) {
      return this.partialCache
    }
    const castSource = this.source as BaseFileSource
    if (!castSource.currentTree) {
      this.logger.warn('No current tree, cannot gather partials')
      return {}
    }

    const foundPartials: Record<string, MDNode> = {}
    for (const node of castSource.currentTree.walkBfs()) {
      if (node instanceof MarkdocDocNode && node.isPartial) {
        const parsed = await node.load()
        foundPartials[node.relPath] = parsed.ast()
      }
    }
    const staticPartials: Record<string, MDNode> = {}
    for (const [key, value] of Object.entries(this.providerConfig.partials)) {
      staticPartials[key] = parse(value)
    }
    this.partialCache = {
      ...staticPartials,
      ...foundPartials,
    }
    return this.partialCache
  }

  isPartialPath(relPath: string): boolean {
    return this.providerConfig.partialHints.some((hint) =>
      relPath.includes(hint)
    )
  }

  static async buildProvider(config: SourceConfig): Promise<DocProvider> {
    let buildSchemaFunc = () => Promise.resolve({} as MDConfig)
    if (
      config.markdownOptions &&
      isMarkdocOptions(config.markdownOptions) &&
      config.markdownOptions.buildSchema
    ) {
      buildSchemaFunc = config.markdownOptions.buildSchema
    }
    const resolvedConfig = await buildSchemaFunc()
    const markdownOptions = config.markdownOptions
    let markdocOpts: Required<MarkdocOptions> = DefaultMarkdocOptions
    if (markdownOptions && isMarkdocOptions(markdownOptions)) {
      markdocOpts = {
        ...DefaultMarkdocOptions,
        ...markdownOptions,
      }
    }
    return new MarkdocFileProvider(config, resolvedConfig, markdocOpts)
  }
}

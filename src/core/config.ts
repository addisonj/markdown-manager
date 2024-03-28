import { Config } from '@markdoc/markdoc'
import { IExtractor } from './extractor'
import { LoggingConfig } from './logging'
import {
  DocFileType,
  DocProvider,
  IDirNode,
  IDocNode,
  IDocSource,
  IMediaNode,
} from './types'
import { IValidator } from './validator'
import { IEnrichment } from './enrichment'
import type { EvaluateOptions } from '@mdx-js/mdx'
import type { PluggableList } from 'unified'

export type SourceTypes = 'files' | 'git' | (() => IDocSource)

export type MarkdownFlavors =
  | 'mdx'
  | 'markdoc'
  | 'markdown'
  | (() => () => DocProvider)

export type SourceOptions = {
  // the markdown extensions to look for
  markdownExtensions?: string[]
  extraFilePatterns?: string[]
  extensionMapping?: Record<string, DocFileType>
  indexDocName?: string
  parseFrontMatter?: (content: string) => Record<string, any>
  frontMatterMarker?: string
}

export type ExtraSourceOptions = SourceOptions & Record<string, any>

export type FileSourceOptions = {
  root: string
} & SourceOptions &
  Record<string, any>

export type MarkdocOptions = {
  type: 'markdoc'
  buildSchema?: () => Promise<Config>
  partials?: Record<string, string>
  partialHints?: string[]
}

export type MdxOptions = {
  type: 'mdx'
  // the base url to use for resolving components
  baseUrl?: string
  // enables plugins that will make the mdx files compatible with docusaurus
  // this includes, frontmatter, directives, admonitions, and gfm
  docusaurusCompatible?: boolean
  // custom remark plugins to use, note, default plugins are still included!
  // use customizeMDXConfig if you want to *remove* plugins
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
  recmaPlugins?: PluggableList
  // custom config for the mdx evaluation,
  // passes the default config and expects an updated config
  customizeMDXConfig?: (config: EvaluateOptions) => EvaluateOptions
}

export function isMarkdocOptions(
  options: any
): options is MarkdocOptions {
  return options && options.type === 'markdoc'
}

export function isMdxOptions(
  options: any
): options is MdxOptions {
  return options && options.type === 'mdx'
}

export type SourceConfig = {
  source: SourceTypes
  options: FileSourceOptions | ExtraSourceOptions
  enableDefaultEnrichments?: boolean
  enableDefaultValidators?: boolean
  enableDefaultExtractors?: boolean
  enrichments?: EnrichmentConfig[]
  markdownFlavor: MarkdownFlavors
  markdownOptions?: MarkdocOptions | MdxOptions | Record<string, any>
} & Record<string, any>

export type ValidatorConfig =
  | {
      name: string
      options?: Record<string, any>
    }
  | (() => IValidator)

export type ExtractorConfig =
  | {
      name: string
      options?: Record<string, any>
    }
  | (() => IExtractor)

export type EnrichmentConfig =
  | {
      name: string
      options?: Record<string, any>
    }
  | (() => IEnrichment)

export type UrlExtractorFunc = (
  doc: IDocNode | IDirNode | IMediaNode
) => string | undefined
export type RepoConfig = {
  urlExtractor?: UrlExtractorFunc
  validators: ValidatorConfig[]
  extractors: ExtractorConfig[]
  sources: Record<string, SourceConfig>
}

export type ManagerConfig = {
  repos: Record<string, RepoConfig>
} & LoggingConfig

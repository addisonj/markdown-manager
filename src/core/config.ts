import { Config } from '@markdoc/markdoc'
import { IExtractor } from './extractor'
import { LoggingConfig } from './logging'
import { DocFileType, DocProvider, IDocSource } from './types'
import { IValidator } from './validator'
import { IEnrichment } from './enrichment'

export type SourceTypes = 'files' | 'git' | (() => IDocSource)

export type MarkdownFlavors =
  | 'mdx'
  | 'markdoc'
  | 'markdown'
  | (() => () => DocProvider)

export type SourceOptions = {
  filePatterns?: string[]
  titleIndexVersionRegex?: RegExp
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
  buildSchema?: () => Promise<Config>
  partials?: Record<string, string>
  partialHints?: string[]
} & Record<string, any>

export function isMarkdocOptions(
  options: Record<string, any>
): options is MarkdocOptions {
  return options.buildSchema !== undefined
}

export type SourceConfig = {
  source: SourceTypes
  options: FileSourceOptions | ExtraSourceOptions
  enableDefaultEnrichments?: boolean
  enableDefaultValidators?: boolean
  enableDefaultExtractors?: boolean
  enrichments?: IEnrichment[]
  markdownFlavor: MarkdownFlavors
  markdownOptions?: MarkdocOptions | Record<string, any>
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

export type RepoConfig = {
  validators: ValidatorConfig[]
  extractors: ExtractorConfig[]
  sources: Record<string, SourceConfig>
}

export type ManagerConfig = {
  repos: Record<string, RepoConfig>
} & LoggingConfig

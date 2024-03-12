import { IValidator } from './validator'
import { IExtractor } from './extractor'
import { DocProvider, IDocSource, IDocNode } from './types'
import { LoggingConfig } from './logging'

export type SourceTypes =
  | 'files'
  | 'git'
  | (<DN extends IDocNode, P extends DocProvider<DN>>() => IDocSource<DN, P>)

export type MarkdownFlavors =
  | 'mdx'
  | 'markdoc'
  | 'markdown'
  | (() => <DN extends IDocNode>() => DocProvider<DN>)

export type SourceConfig = {
  source: SourceTypes
  options: Record<string, any>
  markdownFlavor: MarkdownFlavors
}

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

export type RepoConfig = {
  webUrlPattern: string | ((doc: any) => string)
  validators: ValidatorConfig[]
  extractors: ExtractorConfig[]
  sources: Record<string, SourceConfig>
}

export type ManagerConfig = {
  repos: Record<string, RepoConfig>
} & LoggingConfig

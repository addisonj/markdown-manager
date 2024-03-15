import { MarkdocFileProvider } from '../markdoc/markdoc'
import { MdxFileProvider } from '../mdx/mdx'
import {
  ExtractorConfig,
  ManagerConfig,
  SourceConfig,
  ValidatorConfig,
} from './config'
import { Extraction, IExtractor } from './extractor'
import { BaseFileSource } from './file_source'
import { LoggingApi, getLogger } from './logging'
import { DocRepo } from './repo'
import { DocProvider, IDocRepo, IDocSource } from './types'
import { IValidator } from './validator'

export class Manager {
  private logger: LoggingApi
  private repoCache: Record<string, IDocRepo> = {}
  constructor(private config: ManagerConfig) {
    this.logger = getLogger(config)
  }

  async buildRepo(name: string): Promise<IDocRepo> {
    if (this.repoCache[name]) {
      return this.repoCache[name]
    }
    const sources = this.config.repos[name].sources
    const validators = this.config.repos[name].validators
    const extractors = this.config.repos[name].extractors

    const resSources = await Promise.all(
      Object.keys(sources).map(async (key) => {
        const s = await this.resolveSource(key, sources[key])
        return await s.buildTree()
      })
    )
    const resValidators = validators.map((v) => this.resolveValidator(v))
    const resExtractors = extractors.map((e) => this.resolveExtractor(e))
    const repo = new DocRepo(name, resSources, resValidators, resExtractors)
    this.repoCache[name] = repo
    return repo
  }
  private async resolveSource(name: string, config: SourceConfig): Promise<IDocSource> {
    if (typeof config.source === 'function') {
      return config.source()
    }
    let provider: DocProvider
    // use markdoc for both basic markdown and markdoc
    if (
      config.markdownFlavor === 'markdoc' ||
      config.markdownFlavor === 'markdown'
    ) {
      provider = await MarkdocFileProvider.buildProvider(config)
    } else if (config.markdownFlavor === 'mdx') {
      provider = await MdxFileProvider.buildProvider(config)
    } else {
      throw new Error(`Unknown markdown flavor: ${config.markdownFlavor}`)
    }

    if (config.source === 'files') {
      return new BaseFileSource(
        name,
        config,
        provider,
      )
    } else if (config.source === 'git') {
      throw new Error('Git sources not yet supported')
    } else {
      throw new Error(`Unknown source type: ${config.source}`)
    }
  }

  private resolveExtractor(config: ExtractorConfig): IExtractor {
    if (typeof config === 'function') {
      return config()
    }

    if (config.name === 'frontmatter') {
      // TODO add frontmatter extractor
      return new (class implements IExtractor {
        name: string = 'frontmatter'
        requiresLoad: boolean = false
        extract(repo: IDocRepo): Promise<Extraction<any>[]> {
          throw new Error('Method not implemented.')
        }
      })()
    } else if (config.name === 'markdown') {
      // TODO add markdown extractor
      return new (class implements IExtractor {
        name: string = 'markdown'
        requiresLoad: boolean = true
        extract(repo: IDocRepo): Promise<Extraction<any>[]> {
          throw new Error('Method not implemented.')
        }
      })()
    } else {
      throw new Error(`Unknown extractor: ${config.name}`)
    }
  }

  private resolveValidator(config: ValidatorConfig): IValidator {
    if (typeof config === 'function') {
      return config()
    }

    if (config.name === 'markdown') {
      // TODO add markdown validator
      return new (class implements IValidator {
        name: string = 'markdown'
        requiresLoad: boolean = true
        validate(doc: any): Promise<any> {
          throw new Error('Method not implemented.')
        }
      })()
    } else {
      throw new Error(`Unknown validator: ${config.name}`)
    }
  }
}

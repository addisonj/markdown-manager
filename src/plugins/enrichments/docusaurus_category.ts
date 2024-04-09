import path from 'path'
import type {
  IDirNode,
  IDocSource,
  IEnrichment,
  LoggingApi,
} from '../../core/index.js'
import { parse as parseYaml } from 'yaml'
import { validateCategoryMetadataFile } from '@docusaurus/plugin-content-docs/lib/sidebars/validation.js'
import type { CategoryMetadataFile } from '@docusaurus/plugin-content-docs/lib/sidebars/types.js'

export class DocusaususCategory implements IEnrichment {
  _logger: LoggingApi | null = null
  name: string = 'docusaurus-category'
  metadataFields: string[] = ['categoryMeta']
  description: string =
    'Looks for _category_.json metadata files and adds them to the folder nodes'
  getLogger(source: IDocSource): LoggingApi {
    if (!this._logger) {
      this._logger = source.logger.child({ enrichment: 'docusaurus-category' })
    }
    return this._logger
  }
  validateCategory(
    category: unknown,
    categoryFile: string,
    logger: LoggingApi
  ): CategoryMetadataFile | null {
    try {
      validateCategoryMetadataFile(category)
      return category as CategoryMetadataFile
    } catch (ex: any) {
      logger.warn(`Error parsing ${categoryFile}: ${ex.message}`)
      return null
    }
  }
  async readCategoryPath(
    categoryPath: string,
    source: IDocSource
  ): Promise<string | null> {
    const jsonCategoryPath = path.resolve(categoryPath)
    const haveCategory = await source.fileExists(categoryPath)
    if (!haveCategory) {
      return null
    }
    const content = await source.readFileRaw(jsonCategoryPath)
    const decoded = new TextDecoder('utf-8')
    const contentStr = decoded.decode(content)
    return contentStr
  }
  async readJsonCategory(node: IDirNode): Promise<CategoryMetadataFile | null> {
    const jsonCategoryPath = path.resolve(node.relPath, '_category_.json')
    const contentStr = await this.readCategoryPath(
      jsonCategoryPath,
      node.source
    )
    if (!contentStr) {
      return null
    }
    const logger = this.getLogger(node.source)
    try {
      const category = JSON.parse(contentStr)
      return this.validateCategory(category, jsonCategoryPath, logger)
    } catch (ex: any) {
      logger.warn(`Error parsing ${jsonCategoryPath}: ${ex.message}`)
      return null
    }
  }
  async readYamlCategory(node: IDirNode): Promise<CategoryMetadataFile | null> {
    const yamlCategoryPath = path.resolve(node.relPath, '_category_.yaml')
    const contentStr = await this.readCategoryPath(
      yamlCategoryPath,
      node.source
    )
    if (!contentStr) {
      return null
    }
    const logger = this.getLogger(node.source)
    try {
      const category = parseYaml(contentStr)
      return this.validateCategory(category, yamlCategoryPath, logger)
    } catch (ex: any) {
      logger.warn(`Error parsing ${yamlCategoryPath}: ${ex.message}`)
      return null
    }
  }
  async enrichDir(node: IDirNode): Promise<IDirNode> {
    const category =
      (await this.readJsonCategory(node)) || (await this.readYamlCategory(node))
    if (!category) {
      return Promise.resolve(node)
    }
    if (category.label) {
      node.navTitle = category.label
    }
    // TODO what else should we do with the category metadata by default?

    node.metadata.categoryMeta = category

    return Promise.resolve(node)
  }
}

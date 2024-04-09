import path from 'path'
import { parse } from 'yaml'
import { BaseDocTree } from './tree.js'
import type {
  DocFileType,
  DocProvider,
  IDirNode,
  IDocNode,
  IDocSource,
  IDocTree,
  IMediaNode,
  MediaType,
  Node,
} from './types.js'

import fs from 'fs'
import type { Interface } from 'readline/promises'
import { createInterface } from 'readline/promises'
import { Readable } from 'stream'
import type {
  EnrichmentConfig,
  SourceConfig,
  SourceOptions,
  UrlExtractorFunc,
} from './config.js'
import type { IEnrichment } from './enrichment.js'
import type { IExtractor } from './extractor.js'
import type { LoggingApi } from './logging.js'
import { getLogger } from './logging.js'
import type { IValidator } from './validator.js'
/**
 * A list of file patterns for the most media files
 */
export const DefaultFilePatterns = [
  // NOTE we do *NOT* include markdowk extensions here, as those are added
  // based on the flavor of markdown
  // image types
  './*.bmp',
  './**/*.bmp',
  './*.gif',
  './**/*.gif',
  './*.jpg',
  './**/*.jpg',
  './*.jpeg',
  './**/*.jpeg',
  './*.png',
  './**/*.png',
  './*.svg',
  './**/*.xvg',
  './*.tif',
  './**/*.tif',
  './*.tiff',
  './**/*.tiff',
  './*.webp',
  './**/*.webp',
  // video types
  './*.mp4',
  './**/*.mp4',
  // other text types
  './*.pdf',
  './**/*.pdf',
]

export const DefaultMappingTypes: Record<string, DocFileType> = {
  '.md': 'markdown',
  '.mdoc': 'markdown',
  '.mdx': 'markdown',
  '.bmp': 'image',
  '.gif': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.svg': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.webp': 'image',
  '.mp4': 'video',
  '.pdf': 'document',
}

export type AllSourceOptions = Required<SourceOptions>

export const DefaultSourceOptions: AllSourceOptions = {
  extraFilePatterns: DefaultFilePatterns,
  extensionMapping: DefaultMappingTypes,
  indexDocName: 'index',
  parseFrontMatter: (content: string) => {
    // TODO implement front matter parsing
    const parsed = parse(content)
    if (typeof parsed != 'object') {
      return {}
    } else {
      return parsed
    }
  },
  frontMatterMarker: '---',
  markdownExtensions: ['md'],
}

type RawTree = {
  level: number
  index: number
  path: string
  fullPath: string
  dirs: RawTree[]
  files: string[]
}

/**
 * A base source for documents from a local disk
 */
export abstract class AbstractBaseSource implements IDocSource {
  // the extractors passed in the configuration
  private _enrichments: IEnrichment[] = []
  /**
   *
   * @param sourceRoot must be a *full* file path to the root of the source
   * @param provider the provider for the source
   * @param options options for controlling the source
   */
  constructor(
    public sourceName: string,
    public config: SourceConfig,
    sourceRoot: string,
    provider: DocProvider,
    private urlExtractor: UrlExtractorFunc
  ) {
    this.sourceRoot = sourceRoot
    this.provider = provider
    this.options = {
      ...DefaultSourceOptions,
      ...this.config.options,
    }
    this.logger = getLogger().child({
      source: this.sourceName,
      root: this.sourceRoot,
    })
    const enrichConfigs = this.config.enrichments || []
    this._enrichments = enrichConfigs.map((e) => this.resolveEnrichment(e))
  }
  get enrichments(): IEnrichment[] {
    return [...this._enrichments, ...this.defaultEnrichments()]
  }
  // TODO consider renaming, vestigial from old implementation with multiple type of enrichments
  private onDiscoveryEnrichments(): IEnrichment[] {
    return this.enrichments
  }
  defaultExtractors(): IExtractor[] {
    if (this.config.enableDefaultExtractors) {
      return this.provider.defaultExtractors()
    }
    return []
  }
  defaultValidators(): IValidator[] {
    if (this.config.enableDefaultValidators) {
      return this.provider.defaultValidators()
    }
    return []
  }
  defaultEnrichments(): IEnrichment[] {
    if (this.config.enableDefaultEnrichments) {
      return this.provider.defaultEnrichments()
    }
    return []
  }

  sourceRoot: string
  abstract sourceType: string
  provider: DocProvider
  options: AllSourceOptions
  logger: LoggingApi
  public currentTree?: IDocTree

  private buildRawTree(rawFiles: string[]): RawTree {
    const root = {
      level: 0,
      index: 0,
      path: '',
      fullPath: this.sourceRoot,
      dirs: [],
      files: [],
    }
    function buildNode(relPath: string, parentIndex: number, node: RawTree) {
      const parsed = path.parse(relPath)
      const dirs = parsed.dir.split(path.sep).filter((d) => d.trim() !== '')
      let current = node
      // traverse the dirs and create the nodes
      for (let index = 0; index < dirs.length; index++) {
        const dir = dirs[index]
        const found = current.dirs.find((d) => d.path === dir)
        if (found) {
          current = found
        } else {
          const newNode = {
            level: current.level + 1,
            index: index,
            path: dir,
            fullPath: path.join(current.fullPath, dir),
            dirs: [],
            files: [],
          }
          current.dirs.push(newNode)
          current = newNode
        }
      }
      current.files.push(parsed.base)
    }
    for (let index = 0; index < rawFiles.length; index++) {
      buildNode(rawFiles[index], index, root)
    }
    fs.writeFileSync(
      `/tmp/raw-tree-${this.sourceName}.json`,
      JSON.stringify(root, null, 2)
    )
    return root
  }
  async buildTree(): Promise<IDocTree> {
    const files = await this.listFiles()
    // the raw tree is just the directory structure of all matched files for easy traversal
    const rawTree = this.buildRawTree(files)
    // the immediate children
    const rootChildren: Node[] = []
    // BFS search of raw tree, using a queue
    const queue: RawTree[] = [rawTree]

    // keep a map of all the parents
    const parents: Record<string, { parent?: IDirNode; count: number }> = {}
    parents[''] = { parent: undefined, count: 0 }

    // we traverse the tree in a BFS manner using directories
    // steps:
    // 1. add any dirs to the queue to process later
    // 2. find the parent of the directory being processed
    // 3. create a node for the directory
    // 4. process any files in that directory
    while (queue.length > 0) {
      // STEP 1
      const current = queue.shift()
      if (!current) {
        continue
      }
      this.logger.debug(
        { path: current.path, files: current.files },
        'processing file in queue'
      )
      // add the next dir for processing
      for (const dir of current.dirs) {
        queue.push(dir)
      }
      // END STEP 1

      // STEP 2
      // find the the parent where we add nodes
      let curParent: IDirNode | undefined
      let addNodeFunc: (n: Node) => void
      // if the parent is the root, then we just add it to the children
      if (current.level === 0) {
        addNodeFunc = (n: Node) => rootChildren.push(n)
      } else {
        const parentDir = path.resolve(current.fullPath, '..')
        const parent = parents[parentDir]
        if (!parent) {
          this.logger.error(
            {
              parentDir,
              currentDir: current.fullPath,
              parents: Object.keys(parents),
            },
            'failed to find parent'
          )
          throw new Error('failed to find parent')
        }
        parent.count++
        curParent = parent.parent
        addNodeFunc = (n: Node) => curParent?.addChild(n)
      }
      // END STEP 2

      // STEP 3
      // create the node for the directory
      const relPath = this.ensureRelPath(current.fullPath)
      const newNode = await this.buildDirNode(relPath, current.index, curParent)
      const enriched = await this.enrichDirNode(newNode)
      if (!enriched) {
        this.logger.info('skipping directory node due to enrichment', {
          relPath,
          index: current.index,
        })
        continue
      }
      addNodeFunc(enriched)
      parents[current.fullPath] = { parent: enriched, count: 1 }
      curParent = enriched
      // END STEP 3

      // STEP 4
      // we process the files, using the curParent as the parent for each child
      for (let i = 0; i < current.files.length; i++) {
        const file = current.files[i]
        const relPath = this.ensureRelPath(
          path.join(curParent?.relPath || '', file)
        )
        this.logger.debug(
          {
            file,
            parent: { id: curParent?.relPath, p: curParent?.relPath },
            relPath,
          },
          'adding file'
        )
        const fullPath = this.ensureFullFilePath(relPath)
        const ft = this.getFileType(fullPath)
        if (ft === 'markdown') {
          const newNode = await this.provider.buildDocNode(
            this,
            relPath,
            i,
            curParent
          )
          const enriched = await this.enrichDiscoveryDocNode(newNode)
          if (!enriched) {
            this.logger.info('skipping doc node due to enrichment', {
              relPath,
              index: current.index,
            })
            continue
          }
          addNodeFunc(enriched)
        } else if (ft === 'image' || ft === 'video' || ft === 'document') {
          const newNode = await this.buildMediaNode(relPath, i, curParent)
          const enriched = await this.enrichMediaNode(newNode)
          if (!enriched) {
            this.logger.info('skipping media node due to enrichment', {
              relPath,
              index: current.index,
            })
            continue
          }
          addNodeFunc(enriched)
        }
      }
      // END STEP 4
    }
    this.currentTree = await this.assembleDocTree(this, rootChildren)
    return this.currentTree
  }

  extractUrl(node: IDocNode | IDirNode | IMediaNode): string | undefined {
    return this.urlExtractor(node)
  }

  // a small utility method to ensure we normalize the path
  ensureRelPath(globFile: string): string {
    const fp = this.ensureFullFilePath(globFile)
    return path.relative(this.sourceRoot, fp)
  }

  getFileType(fullPath: string): DocFileType {
    const parsed = path.parse(fullPath)
    return this.options.extensionMapping[parsed.ext] || 'unknown'
  }

  private async enrichDirNode(node: IDirNode): Promise<IDirNode | undefined> {
    let updated = node
    for (const enrichment of this.onDiscoveryEnrichments()) {
      if (!enrichment.enrichDir) {
        updated = node
        continue
      }
      // if the user returns null, we assume they want to remove the node
      const ret = await enrichment.enrichDir(updated)
      if (!ret) {
        return
      }
      updated = ret
    }
    return updated
  }

  private async enrichMediaNode(
    node: IMediaNode
  ): Promise<IMediaNode | undefined> {
    let updated = node
    for (const enrichment of this.onDiscoveryEnrichments()) {
      if (!enrichment.enrichMedia) {
        updated = node
        continue
      }
      // if the user returns null, we assume they want to remove the node
      const ret = await enrichment.enrichMedia(updated)
      if (!ret) {
        return
      }
      updated = ret
    }
    return updated
  }

  private async enrichDiscoveryDocNode(
    node: IDocNode
  ): Promise<IDocNode | undefined> {
    let updated = node
    for (const enrichment of this.onDiscoveryEnrichments()) {
      if (!enrichment.enrichDoc) {
        continue
      }
      // if the user returns null, we assume they want to remove the node
      const ret = await enrichment.enrichDoc(updated)
      if (!ret) {
        return
      }
      updated = ret
    }
    return updated
  }

  abstract listFiles(): Promise<string[]>

  /**
   * Creates a dir node, can be overridden to create custom dir nodes
   * @param fullPath the path to the directory
   * @param parent the parent directory to which this belongs, if null, it is at the root
   */
  abstract buildDirNode(
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<IDirNode>

  /**
   * Creates a media node
   * @param fullPath the path to the media file
   * @param index the index of the file in the directory
   * @param parent the parent direct to which this belongs, if empty, then the file is a root
   */
  abstract buildMediaNode(
    fullPath: string,
    index: number,
    parent?: IDirNode
  ): Promise<IMediaNode>

  /**
   * Safely builds a full link which *must* be within the source root
   * @param relPath
   * @returns
   */
  ensureFullFilePath(relPath: string): string {
    // assume the path is aboslute
    let fullPath = relPath
    if (!path.isAbsolute(relPath)) {
      fullPath = path.join(this.sourceRoot, relPath)
    }
    if (!fullPath.startsWith(this.sourceRoot)) {
      throw new Error('Invalid path, not contained within source root')
    }

    return fullPath
  }

  getMediaType(filePath: string): MediaType {
    const ext = path.extname(filePath)
    return this.options.extensionMapping[ext] || 'unknown'
  }

  isIndexDoc(relPath: string): boolean {
    return path.parse(relPath).name === this.options.indexDocName
  }

  assembleDocTree(
    source: AbstractBaseSource,
    rootNodes: Node[]
  ): Promise<IDocTree> {
    if (this.provider.assembleTree) {
      return this.provider.assembleTree(source, rootNodes)
    }
    return Promise.resolve(new BaseDocTree(source, rootNodes))
  }

  abstract readFileRaw(relPath: string): Promise<ArrayBuffer>

  abstract readFileStream(relPath: string): Promise<Readable>

  abstract fileExists(relPath: string): Promise<boolean>

  async readFileLinesStream(relPath: string): Promise<Interface> {
    const stream = await this.readFileStream(relPath)
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break.
    })
    return rl
  }

  async extractMarkdownMetadata(relPath: string): Promise<Record<string, any>> {
    return new Promise(async (resolve, reject) => {
      try {
        const rl = await this.readFileLinesStream(relPath)

        let lineCount = 0
        let inFrontmatter = false
        let content = ''

        rl.on('line', (line: string) => {
          lineCount++
          if (!inFrontmatter) {
            if (lineCount > 10) {
              rl.close() // This will close the stream as well.
            }
            if (line.trim() === this.options.frontMatterMarker) {
              this.logger.debug('found frontmatter')
              inFrontmatter = true
            }
          } else {
            if (line.trim() === this.options.frontMatterMarker) {
              this.logger.debug('found end of frontmatter')
              rl.close() // This will also close the stream.
              inFrontmatter = false
              return
            }
            if (lineCount > 100) {
              this.logger.warn('frontmatter too long, aborting')
              rl.close()
            }
            content += line + '\n'
          }
        })

        rl.on('close', () => {
          try {
            const parsed = this.options.parseFrontMatter(content)
            resolve(parsed || {})
          } catch (err) {
            reject(err)
          }
        })

        rl.on('error', (err) => {
          reject(err)
        })
      } catch (ex) {
        reject(ex)
      }
    })
  }

  private resolveEnrichment(enrichConfig: EnrichmentConfig): IEnrichment {
    if (typeof enrichConfig === 'function') {
      return enrichConfig()
    }

    // TODO add the default enrichments
    throw new Error('Not implemented')
  }
}

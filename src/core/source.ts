import { BaseDocTree } from './tree'
import {
  Node,
  DocProvider,
  IDirNode,
  IDocSource,
  IDocTree,
  DocFileType,
  IMediaNode,
  MediaType,
} from './types'
import path from 'path'
import slugify from 'slugify'
import { parse } from 'yaml'
import split from 'split2'

import { Readable } from 'stream'
import { LoggingApi, getLogger } from './logging'
import { BaseFileSource } from './file_source'
import { SourceConfig } from './config'
import { SourceOptions } from './config'
/**
 * A list of file patterns for the most common markdown and media files
 */
export const DefaultFilePatterns = [
  // markdown types
  './*.md',
  './**/*.md',
  './*.mdoc',
  './**/*.mdoc',
  './*.mdx',
  './**/*.mdx',
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
  '.mp4': 'video',
  '.pdf': 'document',
}

export type AllSourceOptions = Required<SourceOptions>

export const DefaultSourceOptions: AllSourceOptions = {
  filePatterns: DefaultFilePatterns,
  titleIndexVersionRegex:
    /^(?<idx>\d+)?\s*-?\s*(?<version>v\d+(\.\d+)?(\.\d+)?)?\s*-?\s*(?<name>.*)/,
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
}

export type ExtractedInfo = {
  title: string
  version: string
  index: number
}

type RawTree = {
  level: number
  path: string
  fullPath: string
  dirs: RawTree[]
  files: string[]
}

/**
 * A base source for documents from a local disk
 */
export abstract class AbstractBaseSource implements IDocSource {
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
  }
  sourceRoot: string
  abstract sourceType: string
  provider: DocProvider
  options: AllSourceOptions
  private logger: LoggingApi
  public currentTree?: IDocTree

  private buildRawTree(rawFiles: string[]): RawTree {
    const root = {
      level: 0,
      path: '',
      fullPath: '',
      dirs: [],
      files: [],
    }
    function buildNode(relPath: string, node: RawTree) {
      const parsed = path.parse(relPath)
      const dirs = parsed.dir.split(path.sep).filter((d) => d.trim() !== '')
      let current = node
      // traverse the dirs and create the nodes
      for (const dir of dirs) {
        const found = current.dirs.find((d) => d.path === dir)
        if (found) {
          current = found
        } else {
          const newNode = {
            level: current.level + 1,
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
    for (const file of rawFiles) {
      buildNode(file, root)
    }
    return root
  }
  async buildTree(): Promise<IDocTree> {
    const files = await this.listFiles()
    // the raw tree is just the directory structure of all matched files for easy traversal
    const rawTree = this.buildRawTree(files)
    // the immediate children
    const children: Node[] = []
    // BFS search of raw tree, using a queue
    const queue: RawTree[] = [rawTree]
    // keep a map of all the parents
    const parents: Record<string, { parent?: IDirNode; count: number }> = {}
    parents[''] = { parent: undefined, count: 0 }
    while (queue.length > 0) {
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
        this.logger.debug({ dir: dir.path }, 'adding dir to queue')
        queue.push(dir)
      }
      // find the parent for our current node
      let curParent: IDirNode | undefined
      this.logger.debug({ path: current.path }, 'current.path')
      if (parents[current.fullPath]) {
        this.logger.debug(
          { path: current.fullPath, parent: parents[current.fullPath] },
          'using existing parent'
        )
        parents[current.fullPath].count++
        curParent = parents[current.fullPath].parent
      } else {
        this.logger.debug(
          { path: current.fullPath, parent: parents[current.fullPath] },
          'creating new parent'
        )
        const dirParentPath = path.dirname(current.fullPath)
        // this is a bit ugly... because of the different ways in which root is represented all of these may be options for the 'root' directory
        if (
          dirParentPath === '/' ||
          dirParentPath === '' ||
          dirParentPath === '.'
        ) {
          this.logger.debug('creating root parent')
          curParent = await this.buildDirNode(current.fullPath, 0, undefined)
          parents[current.fullPath] = { parent: curParent, count: 1 }
        } else {
          this.logger.debug({ path: dirParentPath }, 'creating child parent')
          const dirParent = parents[dirParentPath]?.parent
          if (!dirParent) {
            throw new Error('failed to find dirParent')
          }
          const allPath = path.join(dirParent.relPath, current.path)
          curParent = await this.buildDirNode(allPath, 0, dirParent)
        }
        parents[current.fullPath] = { parent: curParent, count: 1 }
        children.push(curParent)
      }

      // we process the files, using hte curParent as the parent for each child
      for (let i = 0; i < current.files.length; i++) {
        const file = current.files[i]
        const relPath = this.ensureRelPath(
          path.join(curParent?.relPath || '', file)
        )
        this.logger.debug(
          {
            file,
            parent: { id: curParent?.id.id, p: curParent?.relPath },
            relPath,
          },
          'adding file'
        )
        const fullPath = this.fullFilePath(relPath)
        const ft = this.getFileType(fullPath)
        if (ft === 'markdown') {
          children.push(
            await this.provider.buildDocNode(this, fullPath, i, curParent)
          )
        } else if (ft === 'image' || ft === 'video' || ft === 'document') {
          children.push(await this.buildMediaNode(fullPath, i, curParent))
        }
      }
    }
    this.currentTree = new BaseDocTree(this, children)
    return this.currentTree
  }

  // a small utility method to ensure we normalize the path
  ensureRelPath(globFile: string): string {
    const fp = this.fullFilePath(globFile)
    return path.relative(this.sourceRoot, fp)
  }

  getFileType(fullPath: string): DocFileType {
    const parsed = path.parse(fullPath)
    return this.options.extensionMapping[parsed.ext] || 'unknown'
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

  buildId(name: string): string {
    return slugify(name)
  }

  /**
   * Safely builds a full link which *must* be within the source root
   * @param relPath
   * @returns
   */
  fullFilePath(relPath: string): string {
    const fullPath = path.join(this.sourceRoot, relPath)
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

  abstract readFileRaw(relPath: string): Promise<ArrayBuffer>

  abstract readFileStream(relPath: string): Promise<Readable>

  async extractMarkdownMetadata(relPath: string): Promise<Record<string, any>> {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.readFileStream(relPath)
        // we check the first few lines are `---` and then catch until the next `---`
        // then we parse using the provided parser
        // if the frontmatter is not found after 10 lines, we return an empty object
        let lineCount = 0
        let inFrontmatter = false
        let content = ''
        const e = new TextEncoder()
        stream.pipe(split()).on('data', (line: string) => {
          lineCount++
          if (!inFrontmatter) {
            if (lineCount > 10) {
              stream.destroy()
            }
            if (line.trim() === this.options.frontMatterMarker) {
              this.logger.debug('found frontmatter')
              inFrontmatter = true
            }
          } else {
            if (line.trim() === this.options.frontMatterMarker) {
              this.logger.debug('found end of frontmatter')
              stream.destroy()
              inFrontmatter = false
              return
            }
            // if frontmatter is more than 100 lines, just abort
            if (lineCount > 100) {
              this.logger.warn('frontmatter too long, aborting')
              stream.destroy()
            }
            content += line + '\n'
          }
        })
        stream.on('close', () => {
          try {
            const parsed = this.options.parseFrontMatter(content)
            resolve(parsed || {})
          } catch (err) {
            reject(err)
          }
        })
        stream.on('error', (err) => {
          reject(err)
        })
      } catch (ex) {
        reject(ex)
      }
    })
  }

  extractTitleVersionIndex(
    fullPath: string,
    index: number,
    parent?: IDirNode
  ): ExtractedInfo {
    const parsed = path.parse(fullPath)
    const match = parsed.name.match(this.options.titleIndexVersionRegex)
    if (match) {
      return {
        title: match.groups?.name || '',
        version: match.groups?.version || '',
        index: parseInt(match.groups?.idx || '0'),
      }
    }
    return {
      title: parsed.name,
      version: parent?.id.version || '',
      index: index,
    }
  }
}



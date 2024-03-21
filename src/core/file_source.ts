import fg from 'fast-glob'
import { createReadStream, promises as fs } from 'fs'
import { Readable } from 'stream'
import { SourceConfig, UrlExtractorFunc } from './config'
import { FileDirNode, FileMediaNode } from './file_node'
import {
  AbstractBaseSource,
} from './source'
import { DocProvider, IDirNode, IDocRepo, IMediaNode } from './types'

export class BaseFileSource extends AbstractBaseSource {
  sourceType: string = 'file'
  constructor(
    sourceName: string,
    config: SourceConfig,
    provider: DocProvider,
    urlExtractor: UrlExtractorFunc
  ) {
    const sourceRoot = config.options.root
    super(sourceName, config, sourceRoot, provider, urlExtractor)
  }
  /**
   * Abstract reading to this class so that all IO can be centralized here
   * @param relPath the full path to the file
   * @param opts
   * @returns
   */
  async readFileRaw(relPath: string): Promise<ArrayBuffer> {
    const buff = await fs.readFile(this.ensureFullFilePath(relPath))
    return buff.buffer
  }

  async readFileStream(relPath: string): Promise<Readable> {
    return createReadStream(this.ensureFullFilePath(relPath))
  }

  async listFiles(): Promise<string[]> {
    return await fg(this.options.filePatterns, { cwd: this.sourceRoot })
  }

  /**
   * Creates a dir node, can be overridden to create custom dir nodes
   * @param fullPath the path to the directory
   * @param parent the parent directory to which this belongs, if null, it is at the root
   */
  async buildDirNode(
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<IDirNode> {
    return Promise.resolve(new FileDirNode(this, fullPath, index, parent))
  }

  /**
   * Creates a media node
   * @param fullPath the path to the media file
   * @param index the index of the file in the directory
   * @param parent the parent direct to which this belongs, if empty, then the file is a root
   */
  async buildMediaNode(
    fullPath: string,
    index: number,
    parent?: IDirNode
  ): Promise<IMediaNode> {
    return Promise.resolve(new FileMediaNode(this, fullPath, index, parent))
  }
}

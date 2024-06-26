import Markdoc from '@markdoc/markdoc'
import { Readable } from 'node:stream'
import pino from 'pino'
import pretty from 'pino-pretty'
import type { IEnrichment } from './enrichment.js'
import type { IExtractor } from './extractor.js'
import { AbstractFileDocNode } from './file_node.js'
import { BaseFileSource } from './file_source.js'
import type { LoggingApi } from './logging.js'
import { getLogger } from './logging.js'
import type {
  DocProvider,
  IDirNode,
  IDocSource,
  ILoadedDocNode,
  OutLink,
} from './types.js'
import type { IValidator } from './validator.js'

// mostly this is just initing the logger
export function setupLogging() {
  const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
  const prettyLogger = pino({ level: LOG_LEVEL }, pretty({ sync: true }))
  const log = getLogger({
    logging: prettyLogger,
  })
  log.info('Logger initialized')
  return log
}

// an implementation of core clasess used
// for testing purposes without any real file system
export class TestDocMock {
  constructor(
    public name: string,
    public content: string,
    public links: OutLink[]
  ) {}
  asArrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new TextEncoder().encode(this.content).buffer)
  }
  asStream(): Promise<Readable> {
    return Promise.resolve(Readable.from(this.content))
  }
}

export class TestDocNode extends AbstractFileDocNode implements ILoadedDocNode {
  providerName: string = 'test-file'
  private content: string
  private _links: OutLink[]
  renderTarget: 'html' | 'react' | 'other' = 'html'
  constructor(
    public mock: TestDocMock,
    source: TestBaseFileSource,
    relPath: string,
    index: number,
    frontmatter: Record<string, any>,
    parent?: IDirNode | undefined
  ) {
    super(source, relPath, index, frontmatter, parent)
    this._links = mock.links
    this.content = mock.content
  }
  renderHtml(): Promise<string> {
    const p = Markdoc.transform(Markdoc.parse(this.ast))
    // render the markdown to html using
    return Promise.resolve(Markdoc.renderers.html(p))
  }
  get ast(): any {
    return this.content
  }
  links(): OutLink[] {
    return this._links
  }
  localLinks(): OutLink[] {
    return this._links.filter((l) => l.type !== 'external')
  }
  load(): Promise<ILoadedDocNode> {
    return this.source.enrichLoadDocNode(this)
  }
  setContent(content: string) {
    this.content = content
  }
}
export class TestFileProvider implements DocProvider {
  private docs: Record<string, TestDocMock> = {}
  private builtDocs: Record<string, TestDocNode> = {}
  private logger: LoggingApi
  constructor(
    docs: Record<string, TestDocMock> = {},
    public enrichments: IEnrichment[] = [],
    public extractors: IExtractor[] = [],
    public validators: IValidator[] = []
  ) {
    this.docs = docs
    this.builtDocs = {}
    this.logger = getLogger().child({ module: 'test-file-provider' })
  }
  defaultExtractors(): IExtractor[] {
    return this.extractors
  }
  defaultValidators(): IValidator[] {
    return this.validators
  }
  defaultEnrichments(): IEnrichment[] {
    return this.enrichments
  }
  addDoc(doc: TestDocMock) {
    this.docs[doc.name] = doc
  }
  name: string = 'test-file'
  async buildDocNode(
    source: IDocSource,
    fullPath: string,
    index: number,
    parent?: IDirNode | undefined
  ): Promise<TestDocNode> {
    const castSource = source as TestBaseFileSource
    const relPath = castSource.ensureRelPath(fullPath)

    if (this.docs[relPath]) {
      const d = this.docs[relPath]
      const frontmatter = await castSource.extractMarkdownMetadata(fullPath)
      const dn = new TestDocNode(
        d,
        castSource,
        relPath,
        index,
        frontmatter,
        parent
      )
      this.builtDocs[relPath] = dn
      return Promise.resolve(dn)
    } else {
      console.log(
        'Document not found',
        relPath,
        Object.keys(this.docs),
        fullPath
      )
      this.logger.warn(
        { relPath, fullPath, docs: Object.keys(this.docs) },
        'Document not found'
      )
    }
    throw new Error('Document not found')
  }

  getFiles(): string[] {
    return Object.keys(this.docs)
  }

  getFile(name: string): TestDocMock | undefined {
    const r = this.docs[name]
    if (!r) {
      console.warn('File not found', name, this.docs)
    }
    return this.docs[name]
  }

  getDoc(name: string): TestDocNode | undefined {
    return this.builtDocs[name]
  }

  clearDocs() {
    this.docs = {}
  }
}
export class TestBaseFileSource extends BaseFileSource {
  provider: TestFileProvider
  async listFiles(): Promise<string[]> {
    return Promise.resolve(this.provider.getFiles())
  }
  async readFileRaw(relPath: string): Promise<ArrayBuffer> {
    const rrelPath = this.ensureRelPath(relPath)
    const file = this.provider.getFile(rrelPath)
    if (!file) return Promise.reject('File not found')
    return file.asArrayBuffer()
  }

  async readFileStream(relPath: string): Promise<Readable> {
    const rrelPath = this.ensureRelPath(relPath)
    const file = this.provider.getFile(rrelPath)
    if (!file) return Promise.reject('File not found')
    return file.asStream()
  }
}

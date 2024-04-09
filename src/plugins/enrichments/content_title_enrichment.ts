import type { IDocNode, IEnrichment } from '../../core/index.js'

/**
 * Extract the title from the first heading in the document and set it as the title of the document
 *
 * Should *not* be used with MDX files, as the MDX loader will already extract the title
 */
export class ContentTitleEnrichment implements IEnrichment {
  name: string = 'content-title-enrichment'
  metadataFields: string[] = []
  description?: string =
    'Extract the title from the first heading in the document and set it as the title of the document'
  async findTitle(node: IDocNode): Promise<string | undefined> {
    return new Promise(async (resolve, reject) => {
      try {
        const rl = await node.source.readFileLinesStream(node.relPath)
        let title: string | undefined
        let found = false
        let lineCount = 0
        rl.on('line', (line: string) => {
          lineCount++
          if (found) {
            return
          }
          if (line.startsWith('# ')) {
            title = line.slice(2)
            found = true
            rl.close()
          }
        })
        rl.on('close', () => {
          resolve(title)
        })
        rl.on('error', (err) => {
          reject(err)
        })
      } catch (ex) {
        reject(ex)
      }
    })
  }
  async enrichDoc(node: IDocNode): Promise<IDocNode> {
    // if we already have a title from frontmatter or metadata, don't run this!
    if (node.frontmatter.title || node.metadata.title) {
      return node
    }
    const title = await this.findTitle(node)
    if (!title) {
      return node
    }
    node.title = title
    node.navTitle = title
    return node
  }
}

import type { Transformer } from 'unified'
import type { Link } from 'mdast'
import {toString as astToString} from 'mdast-util-to-string'
import { visit, CONTINUE } from 'unist-util-visit'
import { OutLink } from '../../core'
import { extractOutLink } from '../../core'

/**
 * A remark plugin to extract the link heading found in Markdown files
 */
export function LinkExtractionPlugin(): Transformer {
  return async (root, vfile) => {
    const links: OutLink[] = []
    visit(root, 'link', (linkNode: Link) => {
      const meta: Record<string, any> = {
        position: linkNode.position,
      }
      const link = extractOutLink(
        linkNode.url,
        linkNode.title || astToString(linkNode),
        meta
      )

      links.push(link)
      return CONTINUE
    })
    vfile.data.links = links
  }
}

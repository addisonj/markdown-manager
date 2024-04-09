// adapted from https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-mdx-loader/src/remark/contentTitle/index.ts
import type { Transformer } from 'unified'
import type { Heading } from 'mdast'
import { toString as astToString } from 'mdast-util-to-string'
import { visit, EXIT } from 'unist-util-visit'

/**
 * A remark plugin to extract the h1 heading found in Markdown files
 * This is exposed as "data.contentTitle" to the processed vfile
 * Also gives the ability to strip that content title (used for the blog plugin)
 */
export function ContentTitlePlugin(): Transformer {
  return async (root, vfile) => {
    visit(root, 'heading', (headingNode: Heading, index, parent) => {
      if (headingNode.depth === 1) {
        vfile.data.contentTitle = astToString(headingNode)
        return EXIT // We only handle the very first heading
      }
      // We only handle contentTitle if it's the very first heading found
      if (headingNode.depth >= 1) {
        return EXIT
      }
      return undefined
    })
  }
}

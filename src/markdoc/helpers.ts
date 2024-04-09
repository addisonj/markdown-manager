import { Node as MDNode, RenderableTreeNode, Tag } from '@markdoc/markdoc'
import GithubSlugger from 'github-slugger'
import {
  DocIndex,
  DocSection,
  HeaderSection,
  OutLink,
  StandaloneSection,
  extractOutLink,
} from '../core'
import { MarkdocDocNode } from './markdoc'

export function extractLinks(filePath: string, ast: MDNode): OutLink[] {
  const links: OutLink[] = []
  for (let n of ast.walk()) {
    if (n.type === 'link') {
      const target = n.attributes?.href
      const title = n.attributes?.title || n.children[0]?.attributes?.content
      if (
        target &&
        typeof target === 'string' &&
        title &&
        typeof title === 'string'
      ) {
        const l = extractOutLink(target, title, { location: n.location })
        links.push(l)
      }
    }
  }
  return links
}

function isMDTag(node: any): node is Tag {
  node = node as Tag
  return node.$$mdtype === 'Tag'
}

function traverse(
  node: RenderableTreeNode | RenderableTreeNode[],
  onNewHeader: (node: Tag) => void,
  onContent: (node: string) => void
) {
  if (!Array.isArray(node)) {
    node = [node]
  }
  for (let el of node) {
    if (el) {
      if (typeof el === 'string') {
        onContent(el)
      } else if (isMDTag(el)) {
        if (el.name.match(/h\d/)) {
          onNewHeader(el)
        }
        traverse(el.children, onNewHeader, onContent)
      }
    }
  }
}
export async function extractIndex(mdNode: MarkdocDocNode): Promise<DocIndex> {
  const slugger = new GithubSlugger()
  const sections: DocSection[] = []
  let currentSection: DocSection | null = null

  function newHeaderSection(
    webUrl: string,
    title: string,
    level: number
  ): HeaderSection {
    const newSection: HeaderSection = {
      webUrl,
      level,
      header: title,
      content: '',
    }
    sections.push(newSection)
    currentSection = newSection

    return newSection
  }

  function addContent(content: string) {
    if (currentSection) {
      currentSection.content += content
    } else {
      const newSection: StandaloneSection = { content }
      sections.push(newSection)
      currentSection = newSection
    }
  }

  // we want to build the render tree so we can
  // extract the sections from the tree with things
  // like partials and other content resolved
  const transformed = await mdNode.buildRenderTree()
  traverse(
    transformed,
    (node) => {
      const foundTitle =
        node.children.find((c) => typeof c === 'string') || 'Untitled'
      const title = foundTitle as string
      const level = node.attributes.level
      const webUrl = `${mdNode.webUrl}#${node.attributes.id || slugger.slug(title)}`
      newHeaderSection(webUrl, title, level)
    },
    addContent
  )

  return {
    webUrl: mdNode.webUrl,
    title: mdNode.title,
    description: mdNode.frontmatter.description,
    tags: mdNode.tags,
    metadata: mdNode.metadata,
    frontmatter: mdNode.frontmatter,
    sections: sections,
  }
}

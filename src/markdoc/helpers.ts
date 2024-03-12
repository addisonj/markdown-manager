import { Node as MDNode, Location as MDLocation } from '@markdoc/markdoc'
import { MarkdocLink } from './markdoc'

export function extractLink(
  link: string,
  title: string,
  location?: any
): MarkdocLink {
  if (
    link.startsWith('http') ||
    link.includes('://') ||
    link.startsWith('mailto:')
  ) {
    return new MarkdocLink('external', link, title, location)
  } else if (link.startsWith('id:')) {
    let id = link.replace('id:', '')
    let anchor: string | null = null
    const anchorIndex = id.indexOf('#')
    if (anchorIndex >= 0) {
      anchor = id.substring(anchorIndex + 1)
      id = id.substring(0, anchorIndex)
    }

    return new MarkdocLink('id', id, title, location)
  } else if (link.startsWith('#')) {
    return new MarkdocLink('anchor', link, title, location)
  } else {
    let anchor: string | null = null
    let relLink: string = link
    const anchorIndex = link.indexOf('#')
    if (anchorIndex >= 0) {
      relLink = link.substring(0, anchorIndex)
      anchor = link.substring(anchorIndex)
    }
    return new MarkdocLink('relative', relLink, title, location)
  }
}

export function extractLinks(filePath: string, ast: MDNode): MarkdocLink[] {
  const links: MarkdocLink[] = []
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
        const l = extractLink(target, title, n.location)
        links.push(l)
      }
    }
  }
  return links
}

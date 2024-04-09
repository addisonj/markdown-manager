import type { OutLink } from './types.js'

function convertSearchParams(params: URLSearchParams): Record<string, string> {
  const c: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    c[key] = value
  }
  return c
}

export function extractOutLink(
  link: string,
  title: string,
  metadata: Record<string, any> = {}
): OutLink {
  if (
    link.startsWith('http') ||
    link.includes('://') ||
    link.startsWith('mailto:')
  ) {
    const isValid = URL.canParse(link)
    if (!isValid) {
      throw new Error('invalid URL: ' + link)
    }
    const parsed = new URL(link)

    return {
      type: 'external',
      rawUrl: link,
      navUrl: parsed.href,
      title,
      metadata,
      fragment: parsed.hash,
      path: parsed.pathname,
      query: convertSearchParams(parsed.searchParams),
    }
  } else if (link.startsWith('id:')) {
    let id = link.replace('id:', '')
    // we parse the rest of the id as thought it were a URL
    // but we just ignore the parts that have a domain
    const isValid = URL.canParse(id, 'http://domain.com')
    if (!isValid) {
      throw new Error('cannot parse id URL: ' + link)
    }
    const parsed = new URL(id, 'http://domain.com')

    return {
      type: 'id',
      rawUrl: link,
      title,
      metadata,
      fragment: parsed.hash,
      // remove the preceeding slash to get back to the id
      path: parsed.pathname.substring(1),
      query: convertSearchParams(parsed.searchParams),
    }
  } else if (link.startsWith('#')) {
    return {
      type: 'fragment',
      title,
      metadata,
      rawUrl: link,
      navUrl: link,
      fragment: link.slice(1),
      query: {},
    }
  } else {
    // we don't have a known domain yet, so we can canonize links
    const isValid = URL.canParse(link, 'http://domain.com')
    if (!isValid) {
      throw new Error('invalid URL: ' + link)
    }
    const parsed = new URL(link, 'http://domain.com')

    return {
      type: 'relative',
      rawUrl: link,
      title,
      metadata,
      fragment: parsed.hash,
      path: parsed.pathname,
      query: convertSearchParams(parsed.searchParams),
    }
  }
}

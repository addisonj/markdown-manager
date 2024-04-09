export type DocIndex = {
  webUrl: string
  title: string
  description: string
  tags: string[]
  metadata: Record<string, any>
  frontmatter: Record<string, any>
  sections: DocSection[]
}

export type DocSection = HeaderSection | StandaloneSection

export function isHeaderSection(
  section: DocSection | null
): section is HeaderSection {
  if (!section) return false
  return (section as HeaderSection).header !== undefined
}

export function isStandaloneSection(
  section: DocSection | null
): section is StandaloneSection {
  if (!section) return false
  return (section as HeaderSection).level === undefined
}

export type StandaloneSection = {
  content: string
}

export type HeaderSection = {
  level: number
  webUrl: string
  header: string
  content: string
}

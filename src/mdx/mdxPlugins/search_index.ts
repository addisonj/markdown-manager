import {
  DocSection,
  HeaderSection,
  StandaloneSection,
} from '../../core'
import { MdxDocNode } from '../mdx'
import type { Transformer } from 'unified'
import {toString as astToString} from 'mdast-util-to-string'
import {visitParents, CONTINUE} from 'unist-util-visit-parents'
import { is } from 'unist-util-is'
import type { Literal, Heading, Image, Node } from 'mdast'

export function SearchIndexPlugin(): Transformer {
  return async (root, vfile) => {
    const node = vfile.data.node as MdxDocNode
    const sections: DocSection[] = []
    let currentSection: DocSection | null = null

    function newHeaderSection(level: number, header: string): HeaderSection {
      const newSection: HeaderSection = {
        level,
        webUrl: node.webUrl,
        header,
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

    visitParents(root, (node: Node, ancestors: Node[]) => {
      if (is(node, 'heading')) {
        const header = node as Heading
        // use the astToString to get the text for any children
        // but since we are doing this here, we must ignore text nodes later on
        const content = astToString(header)
        newHeaderSection(header.depth, content)
      } else if (is(node, 'text')) {
        const text = node as Literal
        // if we hit a text node, we need to check if the parent is a header
        // if it is, if it is, ignore it
        // otherwise, add the text to the content
        if (!ancestors.find((ancestor) => is(ancestor, 'heading'))) {
          addContent(text.value)
        } 
      } else if (is(node, 'image')) {
        // add the alt and title to the content
        const imgNode = node as Image
        if (imgNode.title) {
          addContent(imgNode.title)
        }
        if (imgNode.alt) {
          addContent(imgNode.alt)
        }
      } else if (is(node, {value: 'string'})) {
        const valNode = node as Literal
        addContent(valNode.value)
      }
      return CONTINUE
    })

    // attach the search index to the vfile
    vfile.data.searchIndex = {
      webUrl: node.webUrl,
      title: node.title,
      description: node.frontmatter.description,
      tags: node.tags,
      metadata: node.metadata,
      frontmatter: node.frontmatter,
      sections: sections,
    }
  }
}

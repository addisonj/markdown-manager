import { describe, it, expect, afterEach } from 'vitest'
import { OutLink } from './types'
import {
  TestBaseFileSource,
  TestDocMock,
  TestDocNode,
  TestFileProvider,
  setupLogging,
} from './__testutils'
import { SourceConfig } from './config'

describe('Core Node functions', () => {
  setupLogging()
  const provider = new TestFileProvider()
  const config: SourceConfig = {
    source: 'files',
    markdownFlavor: 'markdoc',
    options: {
      root: '/',
      filePatterns: ['**/*.md'],
    },
  }
  const source = new TestBaseFileSource('nodetest', config, provider)

  async function buildNode(
    name: string,
    content: string,
    links: OutLink[]
  ): Promise<TestDocNode | undefined> {
    const node = new TestDocMock(name, content, links)
    provider.addDoc(node)
    const t = await source.buildTree()
    return provider.getDoc(name)
  }

  afterEach(() => {
    provider.clearDocs()
  })

  describe('Base doc node', () => {
    it('should have the correct properties for a single node', async () => {
      const n = await buildNode('t1/test.md', 'content', [])
      expect(n).toBeDefined()
      if (!n) return
      // Test the initial values of the properties
      expect(n.relPath).toBe('t1/test.md')
      expect(n.type).toBe('file')
      expect(n.pathId).toEqual({ path: 't1/test.md', version: '' })
      expect(n.index).toBe(0)
      expect(n.depth).toBe(1)
      expect(n.parent?.pathId).toStrictEqual({ path: 't1', version: '' })
      expect(n.navTitle).toBe('test')
      expect(n.hidden).toBe(false)
      // ensure metadata is defaulted correctly
      expect(n.title).toBe('test')
      expect(n.tags).toEqual([])
      expect(n.frontmatter).toEqual({})
      expect(n.indexDoc).toBe(false)
      // check methods are working
      expect(await n.asMarkdown()).toBe('content')
      expect(await n.read()).toBe('content')
      expect(n.parents().map((p) => p.pathId.path)).toEqual(['t1'])
      expect(n.links()).toEqual([])
      expect(n.localLinks()).toEqual([])
      expect(await n.renderHtml()).toEqual('<article><p>content</p></article>')
    })
    it('should be able to build sibling nodes', async () => {
      const n1 = await buildNode('t1/test.md', 'content', [])
      const n2 = await buildNode('t1/test2.md', 'content', [])
      expect(n1).toBeDefined()
      expect(n2).toBeDefined()
      if (!n1 || !n2) {
        throw new Error('Node not defined, unexpected')
      }
      expect(n1.parent?.pathId).toStrictEqual(n2.parent?.pathId)
    })
    it('should parse the frontmatter', async () => {
      const md = `---
title: "Test Document"
tags: ["tag1", "tag2"]
hidden: true
---
content
      `
      const n = await buildNode('test.md', md, [])
      expect(n).toBeDefined()
      if (!n) {
        throw new Error('Node not defined, unexpected')
      }
      expect(n.pathId.path).toBe('test.md')
      expect(n.parent).toBeUndefined()
      expect(n.frontmatter).toEqual({
        title: 'Test Document',
        tags: ['tag1', 'tag2'],
        hidden: true,
      })
      expect(n.title).toBe('Test Document')
      expect(n.tags).toEqual(['tag1', 'tag2'])
      expect(n.hidden).toBe(true)
      expect(n.renderHtml()).resolves.toBe('<article><p>content</p></article>')
    })
  })

  describe('Directory node', () => {
    it('should build directory nodes for all files, regardless of depth', async () => {
      const nodes = (
        await Promise.resolve([
          await buildNode('f0/c00.md', 'content', []),
          await buildNode('f0/c01.md', 'content', []),
          await buildNode('f1/c10.md', 'content', []),
          await buildNode('f1/f10/c100.md', 'content', []),
          await buildNode('f1/f11/c110.md', 'content', []),
          await buildNode('f1/f12/f120/f1200/f12000/c120000.md', 'content', []),
          await buildNode('f1/f12/f120/f1200/c12001.md', 'content', []),
          await buildNode('c2.md', 'content', []),
        ])
      ).filter((n) => n !== undefined) as TestDocNode[]
      expect(nodes.length).toBe(8)

      expect(nodes[0].depth).toBe(1)
      expect(nodes[1].depth).toBe(1)
      expect(nodes[2].depth).toBe(1)
      expect(nodes[3].depth).toBe(2)
      expect(nodes[4].depth).toBe(2)
      expect(nodes[5].depth).toBe(5)
      expect(nodes[6].depth).toBe(4)
      expect(nodes[7].depth).toBe(0)
    })
    it('should handle a really really large tree with random nodes', async () => {
      type RandTree = {
        parentPath: string
        dirChildren: Record<string, RandTree>
        files: string[]
      }

      const allNodes: RandTree[] = []
      const randTree: RandTree = {
        parentPath: '',
        dirChildren: {},
        files: [],
      }
      // do 10 random walks of the tree, each time adding 100 nodes
      for (let i = 0; i < 3; i++) {
        let current = randTree
        for (let j = 0; j < 100; j++) {
          // 25% chance of adding a file
          // 25% chance of adding a directory with 1 file as a child, but don't descend
          // 50% chance of descending into an existing directory or create a new one if none exist
          const r = Math.random()
          if (r < 0.25) {
            current.files.push(`f${i}c${j}.md`)
          } else if (r >= 0.25 && r < 0.5) {
            const newDir = {
              parentPath: current.parentPath + `/f${i}c${j}`,
              dirChildren: {},
              files: [`f${i}c${j}.md`],
            }
            current.dirChildren[`f${i}c${j}`] = newDir
            allNodes.push(newDir)
          } else {
            const keys = Object.keys(current.dirChildren)
            if (keys.length > 0) {
              current =
                current.dirChildren[
                  keys[Math.floor(Math.random() * keys.length)]
                ]
            } else {
              // create if we don't have one
              const newDir = {
                parentPath: current.parentPath + `/f${i}c${j}`,
                dirChildren: {},
                files: [],
              }
              current.dirChildren[`f${i}c${j}`] = newDir
              allNodes.push(newDir)
              current = newDir
            }
          }
        }
      }
      const toCreate = allNodes.flatMap((n) => {
        return n.files.map((f) => {
          return `${n.parentPath}/${f}`
        })
      })
      const nodes = (
        await Promise.all(
          toCreate.map((f) => {
            const fn = f.startsWith('/') ? f.substring(1) : f
            return buildNode(fn, 'content', [])
          })
        )
      ).filter((n) => n !== undefined) as TestDocNode[]
      // TODO improve the assertions here
      expect(nodes.length).toBe(toCreate.length)
    })
  })
})

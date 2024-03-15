import { Manager, IDocRepo } from 'markdown-manager'
import path from 'path'

const rootDir = path.resolve(process.cwd(), 'src', 'docs')
const manager = new Manager({
  repos: {
    demo: {
      sources: {
        markdoc: {
          source: 'files',
          markdownFlavor: 'markdoc',
          options: {
            root: path.join(rootDir, 'markdoc'),
          },
          markdownOptions: {
            partials: {
              example: '**an example partial**',
            },
          },
        },
        mdx: {
          source: 'files',
          markdownFlavor: 'mdx',
          options: {
            root: path.join(rootDir, 'mdx'),
          },
        },
      },
      validators: [],
      extractors: [],
    },
  },
  logging: true,
})

let demoRepo: IDocRepo | undefined
export async function getDemoRepo() {
  if (!demoRepo) {
    demoRepo = await manager.buildRepo('demo')
  }
  return demoRepo
}

export async function getDoc(docId: string) {
  const repo = await getDemoRepo()
  return repo.doc(docId)
}

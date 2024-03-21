import React from 'react'
import { getDemoRepo } from '@/lib/library'
import { ReactShape } from 'markdown-manager'
export async function generateStaticParams() {
  const repo = await getDemoRepo()
  const docs = await repo.docs()
  const paths = docs.map((doc) => ({
    docId: doc.relPath.split('/'),
  }))
  console.log('paths', paths)
  return paths
}

export default async function Page({ params }: { params: { docId: string[] } }) {
  const repo = await getDemoRepo()
  console.log('pthe path', params.docId)
  const np = params.docId.join('/')
  console.log('np', np)
  const doc = await repo.docByPath(np)
  if (doc.length === 0) {
    throw new Error('Doc not found')
  }
  const lastDoc = doc[doc.length - 1]

  const readDoc = await lastDoc.load()

  const component = await readDoc.renderReact(React as ReactShape, {})

  return <div>
    {component}
  </div>
}

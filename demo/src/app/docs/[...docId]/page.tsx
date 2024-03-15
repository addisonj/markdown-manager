import React from 'react'
import { getDemoRepo } from '@/lib/library'
import { ReactShape } from 'markdown-library'
export async function generateStaticParams() {
  const repo = await getDemoRepo()
  const docs = await repo.docs()
  const paths = docs.map((doc) => ({
    docId: [doc.id.id],
  }))
  console.log('paths', paths)
  return paths
}

export default async function Page({ params }: { params: { docId: string } }) {
  const repo = await getDemoRepo()
  console.log('pthe path', params.docId)
  const np = params.docId[0]
  console.log('np', np)
  const doc = await repo.doc(np)
  if (doc.length === 0) {
    throw new Error('Doc not found')
  }
  const lastDoc = doc[doc.length - 1]

  const readDoc = await lastDoc.parse()

  const component = await readDoc.renderReact(React as ReactShape, {})

  return <div>
    {component}
  </div>
}

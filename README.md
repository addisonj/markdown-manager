Markdown Manager
#################

**A small library for managing collections of markdown documents with support for enriching with metadata and make it easier to query and structure the data**

## What it does

Most docs-as-code approaches rely on folders of markdown, with each file turning into one page

These means that a lot of other concerns, like site navigation/structure, search and/or tags, link validation, etc concerns that either are part of static site framework or left up to the user.

Markdown manager takes a different approach and offers the following features:

- Ingest markdown (in many flavors) and allows for adding metadata via optional plugins (more information below)
- Frontmatter support, with the ability to query documents based on frontmatter properties
- Document contents (and metadata) can be extracted for easy ingestion into search index
- Markdown Manager includes the ability to place documents into a hierarchial tree of "directories", "documents", and "media". These do not need to be physical directories (but can be) and allow for organizing documents into any hierarchy that maps to navigation structure and/or URL structure
- Fetch and render documents with support for different renders / markdown flavors

## Quick Start

### Install markdown-manager package

`npm install markdown-manager`

### Create a markdown-manager configuration

markdown-manager is powered by a configuration file which determines the document repositories, etc.

_the full configuration options are shown in the [configuration options](#configuration-options) section_

```javascript
export const mdmConfig = {
  repos: {
    "default": { // the name of the repo
      webUrlPattern: "/docs/:id", // a pattern that determines the final url
      validators: [
        {name: "linkChecker", options: {internalLinks: true, externalLink: false}} // configure a set of validators
        {name: "frontmatterFields", options: {
          requiredFields: {
            tags: "array",
          }
        }}
      ],
      extractors: [
        {name: "documentIndex", options: {sections: ['h1', 'h2', 'h3', maxWordsPerSection: 100]}}
      ],
      sources: {
        markdown: {
          source: "files",
          extensions: ['.md'],
          pathRoot: "./docs/",
          markdownFlavor: "markdown"
        },
        markdoc: {
          source: "files",
          extensions: ['.mdoc'],
          pathRoot: "./docs/",
          markdownFlavor: "markdoc"
        }
      }
    }
  }
}
```

### Create the manager instance, validate, etc

```javascript
// manager.js
import { Manager } from 'markdown-manager'
import { mdmConfig } from './mdm-config'
import { searchIndexer } from './my-search-index'
import { cache } from 'react'

export async function getDefaultRepo() {
  const manager = new Manager(mdmConfig)
  const defaultRepo = await manager.buildRepo('default')

  const validationErrors = await defaultRepo.validate()
  const errorLevel = validationErrors.filter(
    (validationError) =>
      validationError.level === 'error' || validationError.level === 'critical'
  )
  if (errorLevel.length > 0) {
    // handle errors
    throw new Error('critical validation errors')
  }

  // extract data and use as needed (for example, building a search index)
  const extractedData = await defaultRepo.extract()
  await searchIndexer.buildSearchIndex(extractedData.documentIndex)

  return defaultRepo
}

export const getDocById = cache(async (id) => {
  const repo = await getDefaultRepo()

  return repo.getDoc(id)
})
```

### Use a doc repo to fetch and render a document in site like next.js

As an example, we use the repo in a next.js app router page

```javascript
// app/docs/[...id]/page.js
import {getDefaultRepo, getDocById} from '../../../manager'

const
export async function generateStaticParams() {
  const repo = getDefaultRepo()

  const docs = repo.docs()

  return docs.map((doc) => ({
    id: doc.id
  }))
}

export default async function Doc({params}) {
  const doc = await getDocById(params.id)

  // depending on the doc type, we may get a different output from
  // the render function. In some cases, it is HTML, in other cases, it may be a react component!

  if (doc.renderTarget === 'react') {
    const DocRenderer = doc.render()
    return <DocRenderer />
  } else {
    return (
      <div
        dangerouslySetInnerHTML={{__html: doc.render()}}
      />
    )
  }
}
```

## Concepts

### Repos

A **repo** represents a group of documents where the docs are all intended to fall under the same destination or search index.

A repo can have multiple _sources_ of documentation, but all docs will be treated the same way in terms of validation rules, extraction processes, etc

### Sources

A **source** provides documents from a location (local or remote) with the same flavor of markdown.

### Markdown flavors

Markdown has had many variants in syntax over the years with different extensions. Some of these may just be custom tags, like [docusaurus admonitions](https://docusaurus.io/docs/markdown-features/admonitions), [MDX](https://mdxjs.com/), and [Markdoc](https://markdoc.dev)

This means that markdown manager cannot perform the same set of actions for all "markdown", for example, markdoc and mdx support partial documents, but the implementations are specific to each flavor. The interface for a flavor does try to create a "generic" markdown file, with additional syntax striped, which is intended for some downstream plugins (like extractors for building a search index)

### Tree / Node

Markdown manager exposes files in a directory like structure. We represent this as a tree which can be iterated over

### Validator / ValidatorSet

A validator is a single rule which should hold true for all matching documents in a repo. Validation errors do have varying levels of severity to allow for different errors to be handled. For example, in a production build we may throw an exception on a broken link during a build, but in a dev/test environment this would instead just be surfaced to the user.

Some validators may be coupled to a specific flavor of markdown, such as those that inspect a document contents, but other may be generic, like those that simple look at the frontmatter.

A ValidatorSet is the set of validators run over a repo, with validators being run in order.

### Extractor

Extractors extract information from the set of documents. Like validators, some validators will be specific to a flavor of markdown, but others are generic.

## Configuration Options

### TODO

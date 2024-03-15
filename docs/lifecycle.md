Markdown manager is designed to be extendable while also remaining fairly performant for large collections of documents.

To make this scalable, markdown-manager has a lifecycle that all documents and repo goes through and understanding this lifecycle
is import to be able to properly extend the library.

## Steps

### 1. Configuring / creating a manager

This is the main requirement of users of the library and a valid configuration that points to the sources, etc is required.

However, even creating a manager does *not* load any data, instead the creation of a repo is the first step that causes markdown-manager to do real work


### 2. Listing documents / media / folders

When `manager.loadRepo` is called, it starts by initiating the listing of documents and media and any parent folders that contain those files

For example, files and folders are listed on a local filesystem via walking the directory and matching any files (and parent folders) that match the provided glob.

*All* files and folders are discovered before any discovery is done. For other sources, say those powered by an API, it is expected that the source returns all documents.

In other words, currently, markdown-manager does not support discovery of documents after the initial listing is done

### 3. Tree building / discovery

After all the files are listed, a process happens whereby we:

1. take the files from the source and group them up into a tree. In cases of a local file system, this is just the folders and directory structure on disk.
2. after we build the tree structure, we "discovery" some initial metadata from any nodes *without* fully reading any contents, for example, with markdown, we read frontmatter
3. onDiscovery enrichments are run. An onDiscovery enrichment can add any data that is required but *should not* load the document, instead features like adding ordering to documents, etc, 

At this point, we have enough metadata that we can answer many questions about *all* documents, like tags, organizational structure, etc, but we *have not* parsed/loaded any full document contents

### 4. Validation

Validation happens *after* the entire repo of documents is known about and *may* happen before documents are loaded. This supports use cases like checking links for internal consistency. Some validators may require documents to be fully loaded, others may not.

In some cases where you have large collections of documents, it may make sense to break up validation into different stages and the repo API supports this, but in most cases, validation will be a single shot which will force documents to be loaded

### 5. Extraction

Extraction is in many use cases optional, but allows for tasks like extracting parts of document for search or for building indexes over documents, like documents with given tags or authors

Extractors, like validators, may not require a document to be loaded, but some do and users have flexibility in determining when to run extractors

### 6. Loading and Rendering

If a document is not already loaded by the previous validation and extraction steps, a user "loads" the document. During the entirety of the document is read into memory and, depending on the markdown flavor, additional processing (liking build an AST of the document) is done.

For performance reasons, it is expected that once a node is loaded, it will not reload the data.

Additionally, once loading is performed, onLoad enrichments can run, which allow for adding more metadata

This means that in some cases, if an extractor wants to extract information from data added by an enrichment, it must also load the documents

In any case, once a document is loaded, it can be rendered
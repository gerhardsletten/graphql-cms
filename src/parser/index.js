const chokidar = require('chokidar')
const fs = require(`fs-extra`)
const { createFileNode, createContentDigest } = require(`./create-file-node`)
const createRemarkNode = require(`./create-remark-node`)
const uuidv5 = require(`uuid/v5`)
const _ = require(`lodash`)
const { defaults, buildConfig } = require('../config')

const createNodeId = path => uuidv5(path, uuidv5.URL)

const NODES = []

const createNode = node => {
  NODES.push(node)
}
const updateNode = (nodeId, node) => {
  const found = NODES.find(({ id }) => id === nodeId)
  Object.keys(node).forEach(k => {
    found[k] = node[k]
  })
}
const createParentChildLink = ({ parent, child }) => {
  const parentNode = NODES.find(({ id }) => id === parent.id)
  parentNode.children.push(child.id)
}

const loadNodeContent = async node => {
  if (_.isString(node.internal.content)) {
    return node.internal.content
  } else {
    return new Promise((resolve, reject) => {
      fs.readFile(node.internal.absolutePath, `utf-8`, (err, content) => {
        if (err) {
          return reject(err)
        }
        resolve(content)
      })
    })
  }
}
function transformNodes({ internal, ...node }) {
  const { relativePath } = internal
  const slug =
    relativePath === 'index.md'
      ? '/'
      : `/${relativePath}`.replace('/index.md', '').replace('.md', '')
  return {
    ...node,
    slug
  }
}

const parseAndWriteMarkdown = async (opts = {}) => {
  const options = buildConfig({ ...defaults, ...opts })
  const allPages = await parseMarkdownFiles(options)
  const mdPages = allPages
    .filter(({ internal: { extension } }) => extension === 'md')
    .map(transformNodes)
  const mdPagesWithParent = mdPages.map(item => {
    const parentSlug = item.slug.substring(0, item.slug.lastIndexOf('/')) || '/'
    const parentPage = mdPages
      .filter(({ slug, id }) => id !== item.id && parentSlug.includes(slug))
      .reduce((found, current) => {
        const prev = found ? found.slug.length : 0
        if (current.slug.length > prev) {
          return current
        }
      }, null)
    return {
      ...item,
      parentId: parentPage ? parentPage.id : null
    }
  })
  await fs.ensureDir(options.outputDir)
  await fs.writeJson(options.outputFilename, mdPagesWithParent)
  return mdPagesWithParent
}

const parseMarkdownFiles = async (opts = {}) => {
  const options = buildConfig({ ...defaults, ...opts })
  const createAndProcessNode = path => {
    const fileNodePromise = createFileNode(path, createNodeId, options).then(
      node => {
        createNode(node)
        return createRemarkNode({
          node,
          loadNodeContent,
          actions: {
            createNode,
            updateNode,
            createParentChildLink
          },
          createNodeId,
          createContentDigest
        })
      }
    )
    return fileNodePromise
  }
  if (!fs.existsSync(options.markdownDir)) {
    throw new Error('Path not found')
  }
  let pathQueue = []
  const flushPathQueue = () => {
    let queue = pathQueue.slice()
    pathQueue = []
    return Promise.all(queue.map(createAndProcessNode))
  }
  const watcher = chokidar.watch(options.markdownDir, {
    ignored: [
      `**/*.un~`,
      `**/.DS_Store`,
      `**/.gitignore`,
      `**/.npmignore`,
      `**/.babelrc`,
      `**/yarn.lock`,
      `**/bower_components`,
      `**/node_modules`,
      `../**/dist/**`,
      ...(options.ignore || [])
    ]
  })
  watcher.on('add', path => {
    pathQueue.push(path)
  })
  watcher.on('addDir', path => {
    pathQueue.push(path)
  })
  return new Promise((resolve, reject) => {
    watcher.on('ready', () => {
      flushPathQueue().then(() => {
        resolve(NODES)
      }, reject)
    })
  })
}
module.exports = {
  parseAndWriteMarkdown,
  parseMarkdownFiles
}

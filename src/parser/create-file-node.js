const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const mime = require('mime')
const prettyBytes = require('pretty-bytes')
const md5File = require('bluebird').promisify(require('md5-file'))

const createContentDigest = input => {
  const content = typeof input !== 'string' ? JSON.stringify(input) : input
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex')
}

exports.createContentDigest = createContentDigest

function slash(path) {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)
  if (isExtendedLengthPath) {
    return path
  }
  return path.replace(/\\/g, '/')
}

exports.createFileNode = async(
  pathToFile,
  createNodeId,
  options = {}
) => {
  const slashed = slash(pathToFile)
  const parsedSlashed = path.parse(slashed)
  const slashedFile = {
    ...parsedSlashed,
    absolutePath: slashed,
    // Useful for limiting graphql query with certain parent directory
    relativeDirectory: path.relative(
      options.markdownDir || process.cwd(),
      parsedSlashed.dir
    ),
  }

  const stats = await fs.stat(slashedFile.absolutePath)
  const internal = {
    absolutePath: slashedFile.absolutePath,
    relativePath: slash(
      path.relative(
        options.markdownDir || process.cwd(),
        slashedFile.absolutePath
      )
    ),
    extension: slashedFile.ext.slice(1).toLowerCase(),
    fileSize: stats.size,
  }
  if (stats.isDirectory()) {
    internal.contentDigest = createContentDigest({
      stats: stats,
      absolutePath: slashedFile.absolutePath,
    })
  } else {
    internal.contentDigest = await md5File(slashedFile.absolutePath)
    const mediaType = mime.getType(slashedFile.ext)
    internal.mediaType = mediaType ? mediaType : 'application/octet-stream'
  }

  // Stringify date objects.
  return JSON.parse(
    JSON.stringify({
      id: createNodeId(pathToFile),
      internal,
      updated: stats.ctime,
      created: stats.birthtime
    })
  )
}

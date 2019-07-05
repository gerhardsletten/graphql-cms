const grayMatter = require(`gray-matter`)
const Remark = require(`remark`)
const _ = require(`lodash`)
const toHAST = require(`mdast-util-to-hast`)
const hastToHTML = require(`hast-util-to-html`)

module.exports = async function onCreateNode(
  { node, loadNodeContent, actions },
  options = {}
) {
  const { updateNode } = actions

  // We only care about markdown content.
  if (
    node.internal.mediaType !== `text/markdown` &&
    node.internal.mediaType !== `text/x-markdown`
  ) {
    return {}
  }

  const content = await loadNodeContent(node)

  try {
    let data = grayMatter(content, options)

    if (data.data) {
      data.data = _.mapValues(data.data, value => {
        if (_.isDate(value)) {
          return value.toJSON()
        }
        return value
      })
    }

    const remarkOptions = {
      commonmark: true,
      footnotes: true,
      gfm: true,
      ...options
    }

    const remark = new Remark().data(`settings`, remarkOptions)
    const markdownAST = remark.parse(data.content)
    const hastOptions = { allowDangerousHTML: true }
    let markdownNode = {
      frontmatter: {
        title: ``,
        ...data.data
      },
      content: hastToHTML(toHAST(markdownAST, hastOptions), hastOptions),
      rawContent: data.content
    }

    updateNode(node.id, markdownNode)
    return markdownNode
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(
      `Error processing Markdown ${
        node.absolutePath ? `file ${node.absolutePath}` : `in node ${node.id}`
      }:\n
      ${err.message}`
    )

    return {} // eslint
  }
}

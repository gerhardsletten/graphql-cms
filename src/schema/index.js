const { schemaComposer } = require('graphql-compose')
const { composeWithJson } = require('graphql-compose-json')
const arraySort = require('array-sort')
const getValue = require('get-value')
const fs = require(`fs-extra`)
const { getNamedType, isSpecifiedScalarType } = require(`graphql`)
const { defaults, buildConfig, readConfigFile } = require('../config')

const isBuiltInScalarType = type => isSpecifiedScalarType(type)
const sortMethods = ['ASC', 'DESC']
const FRONTMATTER_KEY = 'frontmatter'
const EQ = `eq`
const NE = `ne`
const GT = `gt`
const GTE = `gte`
const LT = `lt`
const LTE = `lte`
const CONTAINS = `contains`
const NOT_CONTAINS = `not_contains`
const START_WITH = `start_with`
const END_WITH = `end_with`

const ALLOWED_OPERATORS = {
  Boolean: [EQ, NE],
  Int: [EQ, NE, GT, GTE, LT, LTE],
  Float: [EQ, NE, GT, GTE, LT, LTE],
  ID: [EQ, NE, CONTAINS, NOT_CONTAINS, START_WITH, END_WITH],
  String: [EQ, NE, CONTAINS, NOT_CONTAINS, START_WITH, END_WITH]
}

const FILTER_FN = {
  [EQ]: (k, v) => item => getValue(item, k) === v,
  [NE]: (k, v) => item => {
    // Use null instead of undefine to make thsi work with empty fields
    const value = getValue(item, k) || null
    return value !== v
  },
  [GT]: (k, v) => item => getValue(item, k) > v,
  [GTE]: (k, v) => item => getValue(item, k) >= v,
  [LT]: (k, v) => item => getValue(item, k) < v,
  [LTE]: (k, v) => item => getValue(item, k) <= v,
  [CONTAINS]: (k, v) => item => {
    const value = getValue(item, k)
    return value && value.includes(v)
  },
  [NOT_CONTAINS]: (k, v) => item => {
    const value = getValue(item, k)
    return value && !value.includes(v)
  },
  [START_WITH]: (k, v) => item => {
    const value = getValue(item, k)
    return value && value.startsWith(v)
  },
  [END_WITH]: (k, v) => item => {
    const value = getValue(item, k)
    return value && value.endsWith(v)
  }
}
const DEVIDER_OBJECT = '_'
const DEVIDER_METHOD = '__'

function createSchemaFromConfig(confFile) {
  const opts = readConfigFile(confFile)
  const options = buildConfig({ ...defaults, ...opts })
  const pages = fs.readJsonSync(options.outputFilename)
  return createSchema({ pages })
}

function createSchema({ pages = [] }) {
  const allFrontmatterFields = pages.reduce((obj, item) => {
    const fields = item[FRONTMATTER_KEY]
    if (fields) {
      Object.keys(fields).forEach(k => {
        if (!obj[k]) {
          obj[k] = fields[k]
        }
      })
    }
    return obj
  }, {})

  const FrontmatterTC = composeWithJson('Frontmatter', allFrontmatterFields)

  const PageTC = schemaComposer.createObjectTC({
    name: 'Page',
    fields: {
      id: 'ID!',
      slug: 'String!',
      content: 'String',
      rawContent: 'String',
      updated: 'String',
      created: 'String',
      parentId: 'ID'
    }
  })

  const PageConnectionTC = schemaComposer.createObjectTC({
    name: 'PageConnection',
    fields: {
      count: 'Int!',
      nodes: '[Page]'
    }
  })

  PageTC.addFields({
    [FRONTMATTER_KEY]: {
      type: FrontmatterTC.getType(), // get GraphQL type from PersonTC
      resolve: item => item[FRONTMATTER_KEY]
    }
  })

  const PagesOrderByInputETC = schemaComposer.createEnumTC('PagesOrderByInput')
  const sortFunctions = []
  const PagesWhereInputITC = schemaComposer.createInputTC('PagesWhereInput')

  function extractSortFields(obj, prefix) {
    obj.getFieldNames().forEach(k => {
      const fieldConfig = obj.getFieldConfig(k)
      const type = getNamedType(fieldConfig.type)
      if (isBuiltInScalarType(type)) {
        // Add filter methods
        const filterMethods = ALLOWED_OPERATORS[type]
        filterMethods.forEach(filterMethod => {
          PagesWhereInputITC.addFields({
            [`${
              prefix ? `${prefix}${DEVIDER_OBJECT}` : ''
            }${k}${DEVIDER_METHOD}${filterMethod}`]: type
          })
        })
        // Add sort methods
        sortMethods.forEach(sortMethod => {
          PagesOrderByInputETC.addFields({
            [`${prefix ? `${prefix}_` : ''}${k}_${sortMethod}`]: {
              value: sortFunctions.length
            }
          })
          sortFunctions.push([
            [`${prefix ? `${prefix}.` : ''}${k}`],
            { reverse: sortMethod === sortMethods[1] }
          ])
        })
      }
    })
  }
  extractSortFields(PageTC)
  extractSortFields(FrontmatterTC, FRONTMATTER_KEY)

  // Resolvers

  PageTC.addResolver({
    name: 'findAll',
    type: PageConnectionTC,
    args: {
      limit: { type: 'Int', defaultValue: 10 },
      skip: { type: 'Int', defaultValue: 0 },
      orderBy: { type: PagesOrderByInputETC },
      where: { type: PagesWhereInputITC }
    },
    resolve: ({ args: { skip, limit, orderBy, where } }) => {
      const sortParams = sortFunctions[orderBy || 0]
      let filterFns = []
      if (where) {
        Object.keys(where).forEach(k => {
          const [keyName, method] = k.split(DEVIDER_METHOD)
          filterFns.push(
            FILTER_FN[method](keyName.replace(DEVIDER_OBJECT, '.'), where[k])
          )
        })
      }
      const nodes = arraySort(
        pages.filter(item => {
          if (filterFns.length) {
            return filterFns.every(filterFn => filterFn(item))
          }
          return true
        }),
        ...sortParams
      )
      const count = nodes.length
      return {
        count,
        nodes: nodes.slice(skip, skip + limit)
      }
    }
  })

  PageTC.addResolver({
    name: 'findOne',
    type: PageTC,
    args: {
      id: 'ID',
      slug: 'String'
    },
    resolve: ({ args: { id, slug } }) => {
      const fn = slug
        ? item => item['slug'] === slug
        : item => item['id'] === id
      return pages.find(fn)
    }
  })

  PageTC.addResolver({
    name: 'findPath',
    type: [PageTC],
    args: {
      id: 'ID'
    },
    resolve: ({ args: { id } }) => {
      const findParent = (item, list = []) => {
        if (item.parentId) {
          return findParent(pages.find(page => page.id === item.parentId), [
            item,
            ...list
          ])
        }
        return [item, ...list]
      }
      return findParent(pages.find(item => item.id === id))
    }
  })

  // Relations

  PageTC.addRelation('children', {
    resolver: () => PageTC.getResolver('findAll'),
    prepareArgs: {
      where: source => ({ [`parentId${DEVIDER_METHOD}${EQ}`]: source.id })
    },
    projection: { id: true }
  })
  PageTC.addRelation('parent', {
    resolver: () => PageTC.getResolver('findOne'),
    prepareArgs: {
      id: source => source.parentId
    },
    projection: { parentId: true }
  })
  PageTC.addRelation('path', {
    resolver: () => PageTC.getResolver('findPath'),
    prepareArgs: {
      id: source => source.id
    },
    projection: { id: true }
  })

  schemaComposer.Query.addFields({
    pages: PageTC.getResolver('findAll'),
    page: PageTC.getResolver('findOne')
  })

  return schemaComposer.buildSchema()
}

module.exports = {
  createSchema,
  createSchemaFromConfig
}

# Graphql-cms

Headless CMS serving markdown/remark content through a graphql-service

## Features

* Build markdown/remark directory to json-file with `graphql-cms build`
* Serve it as an graphql-api `graphql-cms build`
* Control usage with a `graphql-cms-config.js` file

See the example-folder

## Features todo

* Use sharp.js to extract inline-image links in markdown and remark custom fields and create next-gen picture tags with responsive images

## Graphql-api

### Fetch a list of pages

```
{
  pages (
    orderBy: frontmatter_order_ASC,
    where:{
      frontmatter_order__ne: null
    }
    limit: 10
    skip: 10
  ) {
    count,
    nodes {
      id
      content
      slug
      frontmatter {
        order
        title
        meta {
          title
          description
        }
      }
    }
  }
}
```

### Fetch a single page by id or slug

```
{
  page(
    slug:"/services"
    # or id: "xyz"
  ) {
    id
    slug
    content
    contentRaw
    children {
      count
      nodes {
        id
        slug
        frontmatter {
          title
        }
      }
    }
    parent {
      id
      slug
      frontmatter {
        title
      }
    }
    path {
      slug
      frontmatter {
        title
      }
    }
  }
}
```

### Types

```
Page {
  id: ID!
  slug: String!
  content: String
  rawContent: String
  updated: String
  created: String
  frontmatter: Frontmatter
    title: String
    # And other remark-fields defined in your .md files
  children: PageConnection
    count: Int
    nodes: [Page]
  path: [Page]
  parent: Page
}
```

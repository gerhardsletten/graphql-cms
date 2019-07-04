const { ApolloServer } = require('apollo-server-micro')
const { createSchemaFromConfig } = require('../src')

const schema = createSchemaFromConfig()

const apolloServer = new ApolloServer({ schema })
module.exports = apolloServer.createHandler()

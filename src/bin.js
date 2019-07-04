#!/usr/bin/env node
const program = require('commander')
const { parseAndWriteMarkdown } = require('./parser')
const { readConfigFile } = require('./config')

program.command('build [config]').action(async confFile => {
  const config = readConfigFile(confFile)
  const pages = await parseAndWriteMarkdown(config)
  // eslint-disable-next-line no-console
  console.log(`Wrote ${pages.length} pages`)
  process.exit()
})

program.parse(process.argv)

const path = require(`path`)
const fs = require(`fs-extra`)

const defaultConfigPath = 'graphql-cms-config.js'

exports.readConfigFile = confFile => {
  const configPath = confFile || defaultConfigPath
  const configPathResolved = path.isAbsolute(configPath) ? path.resolve(configPath) : path.resolve(process.cwd(), configPath)
  const config = fs.existsSync(configPathResolved) ? require(configPathResolved) : {}
  return config
}

exports.defaults = {
  cwd: process.cwd(),
  markdownDir: 'content',
  outputDir: 'build',
  outputFilename: 'pages.js'
}

exports.buildConfig = conf => {
  const { cwd } = conf
  const outputDir = path.isAbsolute(conf.outputDir)
    ? conf.outputDir
    : path.resolve(cwd, conf.outputDir)
  return {
    ...conf,
    markdownDir: path.isAbsolute(conf.markdownDir)
      ? conf.markdownDir
      : path.resolve(cwd, conf.markdownDir),
    outputDir,
    outputFilename: path.isAbsolute(conf.outputFilename)
      ? conf.outputFilename
      : path.resolve(outputDir, conf.outputFilename)
  }
}

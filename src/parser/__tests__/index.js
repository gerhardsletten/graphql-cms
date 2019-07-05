const fs = require(`fs-extra`)
const Parser = require('..')
const config = require('./fixtures/graphql-cms-config')

describe(`Markdown parser`, () => {
  it(`It can parse a folder of markdown-files`, async () => {
    const ensureDir = jest.spyOn(fs, "ensureDir");
    ensureDir.mockImplementation(() => Promise.resolve());
    const writeJson = jest.spyOn(fs, "writeJson");
    writeJson.mockImplementation(() => Promise.resolve());
    const result = await Parser.parseAndWriteMarkdown(config)
    expect(ensureDir).toHaveBeenCalled()
    expect(writeJson).toHaveBeenCalled()
    expect(result).toMatchSnapshot()
    jest.clearAllMocks()
  })
})

'use strict'

const JSON5 = require('json5')
const {readFileSync} = require('fs')
const {join: pJoin} = require('path')
const readCsv = require('../read-csv')

const readJSON5Sync = (path) => {
	return JSON5.parse(readFileSync(path, {encoding: 'utf8'}))
}

const readFilesFromFixture = (fixture) => (file) => {
	return readCsv(pJoin(__dirname, 'fixtures', fixture, file + '.csv'))
}

module.exports = {
	readJSON5Sync,
	readFilesFromFixture,
}

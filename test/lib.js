'use strict'

const JSON5 = require('json5')
const {readFileSync} = require('fs')

const readJSON5Sync = (path) => {
	return JSON5.parse(readFileSync(path, {encoding: 'utf8'}))
}

module.exports = {
	readJSON5Sync,
}

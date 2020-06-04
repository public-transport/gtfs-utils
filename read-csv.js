'use strict'

const fs = require('fs')
const pump = require('pump')
const stripBomStream = require('strip-bom-stream')
const parseCsv = require('csv-parser')

const readCsv = (src) => {
	return pump(
		fs.createReadStream(src),
		stripBomStream(),
		parseCsv(),
		() => {}, // no-op cb
	)
}

module.exports = readCsv

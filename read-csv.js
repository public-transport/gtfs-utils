'use strict'

const {readable: isReadable} = require('is-stream')
const fs = require('fs')
const {pipeline} = require('stream')
const stripBomStream = require('strip-bom-stream')
const parseCsv = require('csv-parser')

const readCsv = async (path) => {
	const isPathStream = isReadable(path)
	if (typeof path !== 'string' && !isPathStream) {
		throw new Error('path must be a string or a Readable stream')
	}

	return pipeline(
		isPathStream ? path : fs.createReadStream(path),
		stripBomStream(),
		parseCsv(),
		() => {}, // no-op cb
	)
}

module.exports = readCsv

'use strict'

const fs = require('fs')
const path = require('path')
const stripBomStream = require('strip-bom-stream')

const readCsv = (src) => {
	const one = fs.createReadStream(src)
	const two = stripBomStream()
	one.pipe(two)
	one.once('error', err => two.destroy(err))
	return two
}

module.exports = readCsv

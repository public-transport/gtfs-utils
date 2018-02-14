'use strict'

const fs = require('fs')
const path = require('path')
const stripBomStream = require('strip-bom-stream')
const parseCsv = require('csv-parser')

const readCsv = (src) => {
	const one = fs.createReadStream(src)
	const two = stripBomStream()
	const three = parseCsv()
	one.pipe(two).pipe(three)
	one.once('error', err => two.destroy(err))
	two.once('error', err => three.destroy(err))
	return three
}

module.exports = readCsv

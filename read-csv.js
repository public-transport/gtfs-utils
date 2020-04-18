'use strict'

const fs = require('fs')
const path = require('path')
const stripBomStream = require('strip-bom-stream')
const parseCsv = require('csv-parser')

// todo: use pump
const readCsv = (src) => {
	const one = fs.createReadStream(src)
	const two = stripBomStream()
	const three = parseCsv()
	// streams are awful
	one.on('error', (err) => {
		// .destroy(err) emits `error` async, but we need it right now
		// todo: find a proper solution
		one.unpipe(two)
		two.unpipe(three)
		three.emit('error', err)
		two.end()
		three.end()
	})
	two.on('error', (err) => {
		// .destroy(err) emits `error` async, but we need it right now
		// todo: find a proper solution
		two.unpipe(three)
		three.emit('error', err)
		three.end()
	})
	one.pipe(two).pipe(three)
	return three
}

module.exports = readCsv

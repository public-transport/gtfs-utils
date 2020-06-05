'use strict'

const {Writable} = require('stream')
const pump = require('pump')
const errorsWithRow = require('./errors-with-row')

const reduceFile = (fileName, file, store, reduce) => {
	return new Promise((resolve, reject) => {
		// todo: for perf, try async iteration over readable instead
		const processor = new Writable({
			objectMode: true,
			write: errorsWithRow(fileName, (row, _, cb) => {
				reduce(row).then(() => cb(), cb)
			}),
		})

		pump(
			file,
			processor,
			(err) => {
				if (err) reject(err)
				else resolve()
			}
		)
	})
}

module.exports = reduceFile

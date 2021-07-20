'use strict'

const {readable: isReadable} = require('is-stream')
const {createReadStream} = require('fs')
const {pipeline} = require('stream')
const stripBomStream = require('strip-bom-stream')
const parseCsv = require('csv-parser')

const readCsv = async (path) => {
	const isPathStream = isReadable(path)
	if (typeof path !== 'string' && !isPathStream) {
		throw new Error('path must be a string or a Readable stream')
	}
	const src = isPathStream ? path : createReadStream(path)

	if (!isPathStream) {
		// When consuming an fs.createReadStream readable stream of a non-
		// existent file via `for await`, it only emits the `ENOENT` error at
		// the first iteration. We want to fail right away though, so we listen
		// for `readable` & `error` here.
		// This sets the stream to flowing/resumed mode, but since we pipe it
		// into another stream right after, that's fine.
		// see also https://nodejs.org/docs/latest-v14.x/api/stream.html#stream_two_reading_modes
		await new Promise((resolve, reject) => {
			const onError = (err) => {
				reject(err)
				src.removeListener('error', onError)
				src.removeListener('readable', onReadable)
			}
			const onReadable = () => {
				resolve()
				src.removeListener('error', onError)
				src.removeListener('readable', onReadable)
			}
			src.on('error', onError)
			src.on('readable', onReadable)
		})
	}

	return pipeline(
		src,
		stripBomStream(),
		parseCsv(),
		() => {}, // no-op cb
	)
}

module.exports = readCsv

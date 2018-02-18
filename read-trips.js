'use strict'

const readTrips = (readFile, filter) => {
	return new Promise((resolve, reject) => {
		const data = readFile('trips')
		data.once('error', (err) => {
			reject(err)
			data.destroy(err)
		})
		data.once('end', (err) => {
			if (!err) setImmediate(resolve, acc)
		})

		const acc = Object.create(null) // by ID
		data.on('data', (t) => {
			if (!filter(t)) return null
			acc[t.trip_id] = t
		})
	})
}

module.exports = readTrips

'use strict'

const readCsv = require('../read-csv')
const readServicesAndExceptions = require('../read-services-and-exceptions')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	for await (const [id, days] of services) {
		console.log(id, days)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})

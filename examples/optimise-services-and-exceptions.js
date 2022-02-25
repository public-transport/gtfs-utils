'use strict'

const {join: pathJoin} = require('path')
const readCsv = require('../read-csv')
const optimiseServicesAndExceptions = require('../optimise-services-and-exceptions')

const fixtureDir = pathJoin(__dirname, '..', 'test', 'fixtures', 'optimise-services-and-exceptions')
const readFile = (file) => {
	return readCsv(pathJoin(fixtureDir, file + '.csv'))
}

;(async () => {
	const optimisedSvcs = optimiseServicesAndExceptions(readFile, 'Europe/Berlin')
	for await (const [id, changed, service, exceptions] of optimisedSvcs) {
		if (changed) {
			console.log(id, 'changed!')
			console.log('service:', service)
			console.log('exceptions:', exceptions)
		} else {
			console.log(id, 'unchanged!', id)
		}
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})

'use strict'

const {join: pathJoin} = require('path')
const readCsv = require('../read-csv')
const readServicesAndExceptions = require('../read-services-and-exceptions')

const benchmarkReadServicesAndExceptions = (suite) => {
	suite.add('readServicesAndExceptions: VBB 2021-09-03 data', (deferred) => {
		const readFile = file => readCsv(pathJoin(__dirname, 'vbb-2021-09-03', file + '.csv'))
		const data = readServicesAndExceptions(readFile, 'Europe/Berlin')

		;(async () => {
			// eslint-disable-next-line no-empty
			for await (const _ of data) {}
		})()
		.then(
			() => deferred.resolve(),
			(err) => deferred.reject(err),
		)
	}, {defer: true})
}

module.exports = benchmarkReadServicesAndExceptions

'use strict'

const readCsv = require('../read-csv')
const computeSchedules = require('../compute-schedules')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
	// return readCsv('/Users/j/playground/delfi-gtfs/2020-05-29/' + file + '.txt')
}

;(async () => {
	const schedules = await computeSchedules(readFile, {
		// trip: t => t.route_id === '197626_3',
	})
	for await (const s of schedules.values()) {
		console.log(s)
	}
})()
.catch(console.error)

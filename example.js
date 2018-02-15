'use strict'

const readCsv = require('./read-csv')
const computeStopoverTimes = require('./compute-stopover-times')

const source = file => readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file))

const filter = (stopover) => (
	stopover.trip_id === 'b-downtown-on-working-days' &&
	stopover.stop_id === 'airport'
)

const times = computeStopoverTimes({
	services: source('calendar.txt'),
	serviceExceptions: source('calendar_dates.txt'),
	trips: source('trips.txt'),
	stopovers: source('stop_times.txt')
}, {stopover: filter}, 'Europe/Berlin')

times.on('error', console.error)
times.on('data', console.log)

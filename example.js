'use strict'

const readCsv = require('./read-csv')
const computeStopoverTimes = require('./compute-stopover-times')

const source = file => readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file))

const filter = (stopover) => (
	stopover.trip_id === 'b-downtown-on-working-days' &&
	stopover.stop_id === 'airport'
)

const times = computeStopoverTimes({
	services: source('calendar.csv'),
	serviceExceptions: source('calendar_dates.csv'),
	trips: source('trips.csv'),
	stopovers: source('stop_times.csv')
}, {stopover: filter}, 'Europe/Berlin')

times.on('data', console.log)

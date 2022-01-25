'use strict'

const {Suite} = require('benchmark')
const parseDate = require('../parse-date')
const datesBetween = require('../lib/dates-between')
const resolveTime = require('../lib/resolve-time')
const benchmarkBuildTrajectory = require('./build-trajectory')
const benchmarkReadServicesAndExceptions = require('./read-services-and-exceptions')

const T0 = 1548975600000 // 2019-02-01T00:00+01:00

const s = new Suite()

s.add('parseDate, Europe/Berlin', () => {
	parseDate('20200418', 'Europe/Berlin')
})

const randomStartDates = new Array(30).fill(null).map(() => {
	const dates = Math.random() * 27 | 0
	const d = new Date(T0 + dates * 24 * 3600 * 1000 + 7200)
	return [
		('0000' + d.getFullYear()).slice(-4),
		('00' + (d.getMonth() + 1)).slice(-2),
		('00' + d.getDay()).slice(-2),
	].join('')
})

const allWeekdays = {
	monday: true,
	tuesday: true,
	wednesday: true,
	thursday: true,
	friday: true,
	saturday: true,
	sunday: true
}
s.add('datesBetween: static arguments', () => {
	datesBetween('20200202', '20200606', allWeekdays, 'Europe/Berlin')
})
s.add('datesBetween: random start date', () => {
	const startDate = randomStartDates[Math.random() * randomStartDates.length | 0]
	datesBetween(startDate, '20200606', allWeekdays, 'Europe/Berlin')
})

const randomTimes = new Array(50).fill(null)
.map(() => (Math.random() * 27 * 3600) | 0) // GTFS Time values can be >24h

s.add('resolveTime: static arguments', () => {
	resolveTime('Europe/Berlin', '2019-02-01', 15 * 3600 + 30 * 60)
})
s.add('resolveTime: random time', () => {
	const time = randomTimes[Math.random() * randomTimes.length | 0]
	resolveTime('Europe/Berlin', '2019-02-01', time)
})
// todo: resolveTime: random date & time

benchmarkBuildTrajectory(s)
benchmarkReadServicesAndExceptions(s)

s.on('error', (err) => {
	console.error(err)
	process.exitCode = 1
})
s.on('cycle', (e) => {
	console.log(e.target.toString())
})
s.run()

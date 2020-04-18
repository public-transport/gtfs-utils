'use strict'

const {Suite} = require('benchmark')
const parseDate = require('./parse-date')
const daysBetween = require('./lib/days-between')

const s = new Suite()

s.add('parseDate, Europe/Berlin', () => {
	parseDate('20200418', 'Europe/Berlin')
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
s.add('daysBetween', () => {
	daysBetween('20200202', '20200606', allWeekdays, 'Europe/Berlin')
})

s.on('error', (err) => {
	console.error(err)
	process.exitCode = 1
})
s.on('cycle', (e) => {
	console.log(e.target.toString())
})
s.run()

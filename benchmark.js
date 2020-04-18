'use strict'

const {Suite} = require('benchmark')
const parseDate = require('./parse-date')

const s = new Suite()

s.add('parseDate, Europe/Berlin', () => {
	parseDate('20200418', 'Europe/Berlin')
})

s.on('error', (err) => {
	console.error(err)
	process.exitCode = 1
})
s.on('cycle', (e) => {
	console.log(e.target.toString())
})
s.run()

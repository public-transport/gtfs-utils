'use strict'

const parseDate = require('../parse-date')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const noWeekdays = {
	sunday: false,
	monday: false,
	tuesday: false,
	wednesday: false,
	thursday: false,
	friday: false,
	saturday: false
}

const day = 24 * 60 * 60

const weekdayIndexes = [
	// JS week starts with Sunday
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday'
]

const computeDaysBetween = (beginning, end, weekdays, timezone) => {
	if (!isObj(weekdays)) throw new Error('weekdays must be an object.')
	weekdays = Object.assign(Object.create(null), noWeekdays, weekdays)
	for (let weekday in weekdays) {
		if ('boolean' !== typeof weekdays[weekday]) {
			throw new Error(`weekdays.${weekday} must be a boolean.`)
		}
	}

	beginning = parseDate(beginning, timezone)
	end = parseDate(end, timezone)

	const days = []
	for (let t = beginning; t <= end; t += day) {
		const weekday = weekdayIndexes[new Date(t * 1000).getDay()]
		if (weekdays[weekday]) days.push(t)
	}
	return days
}

module.exports = computeDaysBetween

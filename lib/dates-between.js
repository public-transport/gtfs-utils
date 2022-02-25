'use strict'

const LRUCache = require('quick-lru')

const parseDate = require('./parse-date')

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

const date = 24 * 60 * 60

const weekdayIndexes = [
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
]

const cache = new LRUCache({maxSize: 50})

const computeDatesBetween = (beginning, end, weekdays, timezone, weekdayMap = null) => {
	if (!isObj(weekdays)) throw new Error('weekdays must be an object.')
	weekdays = Object.assign(Object.create(null), noWeekdays, weekdays)
	for (let weekday in weekdays) {
		if ('boolean' !== typeof weekdays[weekday]) {
			throw new Error(`weekdays.${weekday} must be a boolean.`)
		}
	}

	const signature = [
		beginning,
		end,
		weekdays.monday,
		weekdays.tuesday,
		weekdays.wednesday,
		weekdays.thursday,
		weekdays.friday,
		weekdays.saturday,
		weekdays.sunday,
		timezone,
		weekdayMap !== null ? 'wd' : '',
	].join('-')
	if (cache.has(signature)) {
		return Array.from(cache.get(signature))
	}

	beginning = parseDate(beginning)
	end = parseDate(end)
	end = Date.parse(end + 'T00:00Z')

	const dates = []
	let t = new Date(beginning + 'T00:00Z')
	for (let i = 0; t <= end; i++) {
		const weekday = t.getUTCDay()
		if (weekdays[weekdayIndexes[weekday]]) {
			const date = t.toISOString().slice(0, 10)
			dates.push(date)

			if (weekdayMap !== null) {
				weekdayMap.set(date, weekday)
			}
		}
		t.setUTCDate(t.getUTCDate() + 1)
	}

	cache.set(signature, Array.from(dates)) // don't hold reference to `dates`
	return dates
}

module.exports = computeDatesBetween

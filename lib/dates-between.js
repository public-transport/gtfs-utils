'use strict'

const LRUCache = require('quick-lru')
const addDays = require('date-fns/addDays')

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

const computeDatesBetween = (beginning, end, weekdays, timezone) => {
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
	].join('-')
	if (cache.has(signature)) return cache.get(signature)

	beginning = parseDate(beginning)
	end = parseDate(end)
	end = Date.parse(end + 'T00:00Z')

	const dates = []
	let t = new Date(beginning + 'T00:00Z')
	for (let i = 0; t <= end; i++) {
		if (weekdays[weekdayIndexes[t.getDay()]]) {
			dates.push(t.toISOString().slice(0, 10))
		}
		t = addDays(t, 1)
	}

	cache.set(signature, dates)
	return dates
}

module.exports = computeDatesBetween

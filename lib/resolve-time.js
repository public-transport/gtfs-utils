'use strict'

const LRUCache = require('quick-lru')
const {DateTime} = require('luxon')

// > Time - Time in the HH:MM:SS format (H:MM:SS is also accepted). The time
// is measured from "noon minus 12h" of the service day (effectively midnight
// except for days on which daylight savings time changes occur). For times
// occurring after midnight, enter the time as a value greater than 24:00:00 in
// HH:MM:SS local time for the day on which the trip schedule begins.
// Example: 14:30:00 for 2:30PM or 25:35:00 for 1:35AM on the next day.

// see also https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6

const cache = new LRUCache({maxSize: 100})
const baseCache = new LRUCache({maxSize: 100})

const resolveGtfsTime = (timezone, t0, time) => {
	const signature = `${timezone}-${t0}-${time}`
	if (cache.has(signature)) {
		return cache.get(signature)
	}

	let base
	if (baseCache.has(`${timezone}-${0}`)) {
		base = baseCache.get(`${timezone}-${0}`)
	} else {
		base = DateTime.fromMillis(t0 * 1000, {zone: timezone})
		.set({hour: 12}).minus({hours: 12}) // "noon minus 12h"
		baseCache.set(t0 + '', base)
	}

	const res = base.plus(time * 1000).toMillis() / 1000 | 0

	cache.set(signature, res)
	return res
}

module.exports = resolveGtfsTime

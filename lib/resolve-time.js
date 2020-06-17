'use strict'

const {DateTime} = require('luxon')

// > Time - Time in the HH:MM:SS format (H:MM:SS is also accepted). The time
// is measured from "noon minus 12h" of the service day (effectively midnight
// except for days on which daylight savings time changes occur). For times
// occurring after midnight, enter the time as a value greater than 24:00:00 in
// HH:MM:SS local time for the day on which the trip schedule begins.
// Example: 14:30:00 for 2:30PM or 25:35:00 for 1:35AM on the next day.

// see also https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6

const resolveGtfsTime = (timezone, t0, time) => {
	// todo: use LRU cache for this, with t0 as key?
	const base = DateTime.fromMillis(t0 * 1000, {zone: timezone})
	.set({hour: 12}).minus({hours: 12}) // "noon minus 12h"

	const t = typeof time === 'number'
		? base.plus(time * 1000)
		: base.plus({
			hours: time.hours,
			minutes: time.minutes,
			seconds: time.seconds,
		})
	return t.toMillis() / 1000 | 0
}

module.exports = resolveGtfsTime

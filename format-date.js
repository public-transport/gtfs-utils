'use strict'

const {DateTime} = require('luxon')

const formatDate = (t, timezone) => {
	if ('number' !== typeof t) {
		throw new Error('millis must be a number.')
	}
	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}

	return DateTime.fromMillis(t * 1000, {
		zone: timezone
	}).toFormat('yyyyMMdd')
}

module.exports = formatDate

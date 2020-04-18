'use strict'

const {zonedTimeToUtc} = require('date-fns-tz')

const dateFormat = /^\d{8}$/

const parseDate = (str, timezone) => {
	if ('string' !== typeof str) throw new Error('str must be a string.')
	if (!dateFormat.test(str)) throw new Error('str must be YYYYMMDD.')
	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}

	const isoDate = [
		str.substr(0, 4),
		str.substr(4, 2),
		str.substr(6, 2)
	].join('-')
	const millis = +zonedTimeToUtc(isoDate + ' 00:00', timezone)
	return millis / 1000 | 0 // make UNIX timestamp
}

module.exports = parseDate

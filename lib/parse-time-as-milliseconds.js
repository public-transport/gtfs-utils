'use strict'

const parseTime = require('../parse-time')

const parseTimeAsMilliseconds = (str) => {
	const t = parseTime(str)
	return t.hours * 3600 + t.minutes * 60 + (t.seconds || 0)
}

module.exports = parseTimeAsMilliseconds

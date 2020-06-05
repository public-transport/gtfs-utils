'use strict'

const parseTime = require('../parse-time')

// relative to the beginning to the day
const parseRelativeTime = (str) => {
	const t = parseTime(str)
	return t.hours * 3600 + t.minutes * 60 + (t.seconds || 0)
}

module.exports = parseRelativeTime

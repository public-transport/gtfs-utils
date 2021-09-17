/* eslint-disable no-empty */
'use strict'

const test = require('tape')

const createIterateMatching = require('../lib/iterate-matching')

const asyncIterableFrom = (...vals) => (async function* () {for (const val of vals) yield val})()

test('iterate-matching: works with an async iterable', async (t) => {
	const A = asyncIterableFrom(1, 2, 3)
	const B = asyncIterableFrom('2', '2', '4')
	const cmp = (a, b) => a - b
	const matching = createIterateMatching(cmp, B)

	const res = []
	for await (const a of A) {
		const m = []
		for await (const b of matching(a)) m.push(b)
		res.push([a, m])
	}

	t.deepEqual(res, [
		[1, []],
		[2, ['2', '2']],
		[3, []],
	])
	t.end()
})

test('iterate-matching: works with an empty matching set', async (t) => {
	const A = asyncIterableFrom('foo', 'bar')
	const B = asyncIterableFrom()
	const cmp = (a, b) => 0
	const matching = createIterateMatching(cmp, B)

	for await (const a of A) {
		for await (const b of matching(a)) {
			t.fail('matching emitted even though the model set is empty')
		}
	}
	t.end()
})

test('iterate-matching: exposes skipped items', async (t) => {
	let skipped = [], it

	const B = asyncIterableFrom(0, .1, 1, 2, 2, 3, 3.1, 4, 5, 6)
	const cmp = (a, b) => a - b
	const matching = createIterateMatching(cmp, B, val => skipped.push(val))

	t.deepEqual(skipped, [])
	it = matching(1)
	await it.next()
	t.deepEqual(skipped, [0, .1])
	for await (const _ of it) {}

	it = matching(2)
	await it.next()
	t.deepEqual(skipped, [0, .1])
	for await (const _ of it) {}
	for await (const _ of matching(2)) {}

	it = matching(4)
	await it.next()
	t.deepEqual(skipped, [0, .1, 3, 3.1])
	for await (const _ of it) {}

	t.end()
})

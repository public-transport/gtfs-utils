#!/bin/bash

set -e
set -o pipefail

function sort() {
	if [ -f "$1" ]; then
		2>&1 echo "$ mlr --csv sort ${@:2} $1"
		mlr --csv sort ${@:2} "$1" | sponge "$1"
	fi
}

sort agency.csv -f agency_id
sort stops.csv -f stop_id
sort routes.csv -f route_id
sort trips.csv -f trip_id

# Miller uses too much memory sorting large files, so we bend over backwards
# here and use GNU sort, which doesn't handle `"`-escaped values. First, we
# move the stop_sequence and trip_id columns to the front in order to minimize
# the likelihood of (escaped) values that contain the `,` delimiter confusing
# sort. This is quite ugly, find sth better, see #34.
set +e
sort=$(command -v gsort)
if [ $? -ne 0 ]; then sort=$(command -v sort); fi
set -e
header="$(head -n 2 stop_times.csv | mlr --csv reorder -f trip_id,stop_sequence | head -n 1)"
2>&1 echo "mlr --csv reorder -f trip_id,stop_sequence stop_times | $sort -t, -s -k2,2 -k1,1n"
mlr --csv --headerless-csv-output reorder -f trip_id,stop_sequence stop_times.csv \
	| $sort -t, -s -k2,2 -k1,1n \
	| awk -v "header=$header" 'BEGIN{print header}{print $1}' \
	| sponge stop_times.csv

sort calendar.csv -f service_id
sort calendar_dates.csv -f service_id,date
# todo: sort start_time properly (it may be HH:MM:SS or H:MM:SS)
sort frequencies.csv -f trip_id,start_time

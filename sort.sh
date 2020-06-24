#!/bin/bash

set -e
set -o pipefail

function sort() {
	if [ -f "$1" ]; then
		echo "$ xsv sort -s $2 $1"
		xsv sort -s "$2" "$1" | sponge "$1"
	fi
}

sort agency.txt agency_id
sort stops.txt stop_id
sort routes.txt route_id
sort trips.txt trip_id
sort stop_times.txt trip_id,stop_sequence
sort calendar.txt service_id
sort calendar_dates.txt service_id,date
sort frequencies.txt trip_id,start_time

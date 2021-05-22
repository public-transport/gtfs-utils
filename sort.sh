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
# For stations (loc_type 1), parent_station must be empty.
# We get stations first by sorting on parent_station.
sort stops.csv -f parent_station -nr location_type
sort routes.csv -f route_id
sort trips.csv -f trip_id
sort stop_times.csv -f trip_id -n stop_sequence
sort calendar.csv -f service_id
sort calendar_dates.csv -f service_id,date
sort shapes.csv -f shape_id -n shape_pt_sequence
# todo: sort start_time properly (it may be HH:MM:SS or H:MM:SS)
sort frequencies.csv -f trip_id,start_time

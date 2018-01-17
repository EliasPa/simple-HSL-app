var express = require('express');
var curl = require('curl');
var app = express();
var bParser = require('body-parser');
var axios = require('axios');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use(bParser.json());
app.use(bParser.urlencoded({
    extended: true
}));

app.listen(3001);

var address = 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql'

var counter = 0

function makeQuery(data) {
    console.log(counter)
    counter += 1
    console.log(data)
    console.log(data.end)
    console.log(data.start)

    console.log(data.end_coord)
    console.log(data.start_coord)
    var now = new Date();
    var time = now.toString().split(' ')[4];

    var month = (now.getMonth() + 1).toString();
    if (month.length == 1) month = '0' + month;

    var d = now.getDate().toString();
    if (d.length == 1) d = '0' + d;

    var year = now.getFullYear();
    var date = "" + year + "-" + month + "-" + d;

    var from = data.start_coord;
    var to = data.end_coord;

    var fromPlace = data.start;
    var toPlace = data.end;

    var query = `{
        plan(
        fromPlace: "` + fromPlace + `",
        from: {lat: ` + from.lat + `, lon: ` + from.lon + `},
        toPlace: "` + toPlace + `",
        to: {lat: ` + to.lat + `, lon: ` + to.lon + `},
        date: "` + date + `",
        time: "` + time + `"
        numItineraries: 1,
        modes: "BUS,WALK",
        walkReluctance: 2.1,
        walkBoardCost: 600,
        minTransferTime: 600,
        walkSpeed: 1.7,
        ) {
        itineraries{
            walkDistance,
            duration,
            legs {
                mode
                route {
                    shortName
                }
                startTime
                endTime
                from {
                    lat
                    lon
                    name
                    stop {
                        code
                        name
                    }
                },
                to {
                    lat
                    lon
                    name
                },
                agency {
                    id
                },
                distance
                legGeometry {
                    length
                    points
                }
            }
        }
        }
    }`

    return query;
}

function queryHSL(data, callback) {
    var query = makeQuery(data)
    curl.post(address, query, { "Content-Type": "application/graphql" }, function (err, response, body) {
        if (err) {
            callback({ message: 'Internal error.', status: 500 })
        }
        else {
            console.log("from hsl query: " + response.statusCode);
            if (response.statusCode != 200) callback({ message: 'Could not get data.', status: 450 })
            else {
                var json = JSON.parse(body).data.plan;
                var itineraries = json.itineraries;
                var itinerary = []
                for (i = 0; i < itineraries.length; i++) {
                    var it = itineraries[i];
                    itinerary.push({ duration: it.duration, walkDistance: it.walkDistance, legs: it.legs });
                }

                var walkDistance = 0;
                var startTime = 0;
                var endTime = 0;
                var startStop = '';
                var endStop = '';
                var bus = '';

                for (i = 0; i < itinerary.length; i++) {
                    var it = itinerary[i];
                    walkDistance = Math.ceil(it.walkDistance);
                    for (j = 0; j < it.legs.length; j++) {
                        var leg = it.legs[j];
                        if (leg.mode == 'BUS') {
                            startTime = leg.startTime;
                            endTime = leg.endTime;
                            startStop = leg.from.name
                            endStop = leg.to.name
                            bus = leg.route.shortName
                        }
                    }
                }
                var now = new Date();
                var duration = Math.ceil((endTime - startTime) / 1000.0 / 60.0);
                var wholeTime = Math.ceil((endTime - now.getTime()) / 1000.0 / 60);
                var leaving = (startTime - now.getTime()) / 1000.0 / 60;
                var startTime = new Date(startTime);
                var endTime = new Date(endTime);

                var ss = startTime.toString().split(" ")[4];
                var es = endTime.toString().split(" ")[4];
                callback({
                    bus: bus,
                    walkDistance:
                        walkDistance,
                    ss: ss,
                    es: es,
                    startStop: startStop,
                    endStop: endStop,
                    duration: duration,
                    wholeTime: wholeTime,
                    leaving: leaving,
                    status: 200
                });
            }
        }
    });
}

function makeCoordsQuery(location) {

    console.log('query from: ' + location);

    var query = `
        {
            stops(name: "`+ location + `"){
                lat
                lon
            }
        }
    `
    return query;
}

function setCoords(coords, query, callback) {
    axios({
        method: 'post',
        url: address,
        data: query,
        headers: { "Content-Type": "application/graphql" }
    }).then(function (response) {
        var stops = response.data.data.stops
        if (stops.length != 0) {
            var stop = stops[0];
            coords.lat = stop.lat;
            coords.lon = stop.lon;
            callback({ lat: stop.lat, lat: stop.lon, status: 200 })
        } else {
            callback({ message: 'No stops found.', status: 400 })
        }
    }).catch(function (error) {
        if (error.response.status == 500) {
            callback({ error: error.response.statusText, status: error.response.status })
        } else {
            callback({ error: 'Unhandled error.', status: 450 })
        }
    });
}

function printArray(data) {
    for (i = 0; i < data.length; i++) {
        console.log(data[i]);
    }
}

//queryN(1);
function queryN(n) {
    //for (var i = 0; i < n; i++) {
    axios.post(address, query, { "Content-Type": "application/graphql" }).then(function (body, b) { console.log('curl then success? ' + JSON.parse(body).data) }).catch(function (error) { console.log(error.response.statusText) });
    //}
}

app.post('/data', function (req, res) {
    res.set('Content-Type', 'application/json')
    res.set('Access-Control-Allow-Origin', '*')
    queryHSL(req.body, function (response) {
        res.send(response);
    })
})

app.post('/set', function (req, res) {
    var data = req.body;

    var start = data.start;
    var end = data.end;

    setAllCoords(start, end, function (response) {
        res.send(response)
    })

});

function setAllCoords(start, end, callback) {

    var start_coord = { lat: 0, lon: 0 };
    var end_coord = { lat: 0, lon: 0 };

    var start_query = makeCoordsQuery(start);
    var end_query = makeCoordsQuery(end);
    setCoords(start_coord, start_query, function (response) {
        if (response.status == 200) {
            setCoords(end_coord, end_query, function (response) {
                if (response.status == 200) {
                    callback({
                        message: 'Coordinates are set',
                        data:
                            {
                                start: start,
                                end: end,
                                start_coord: start_coord,
                                end_coord: end_coord
                            },
                        status: 200
                    })
                } else {
                    callback(response)
                }
            })
        } else {
            callback(response)
        }
    })
}
var express = require('express');
var curl = require('curl');
var app = express();
var bParser = require('body-parser');
var axios = require('axios');
var helper = require('./helper.js')
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

var port = process.env.PORT || 3000

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})

app.use(bParser.json())
app.use(bParser.urlencoded({
    extended: true
}));

app.listen(port)
console.log('Listening to port ' + port)

function queryHSL(data, callback) {
    var query = helper.makeQuery(data)
    curl.post(helper.address, query, { "Content-Type": "application/graphql" }, function (err, response, body) {
        if (err) {
            callback({ message: 'Internal error.', status: 500 })
        }
        else {
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


function setCoords(coords, query, callback) {
    axios({
        method: 'post',
        url: helper.address,
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
            callback({ message: 'Sorry no stops found! Please try again', status: 400 })
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

function queryN(n) {
    axios.post(helper.address, query, { "Content-Type": "application/graphql" }).then(function (body, b) { console.log('curl then success? ' + JSON.parse(body).data) }).catch(function (error) { console.log(error.response.statusText) });
}

app.post('/data', function (req, res) {
    queryHSL(req.body, function (response) {
        res.send(response);
    })
})

app.post('/set', function (req, res) {
    var start = req.body.start;
    var end = req.body.end;
    setAllCoords(start, end, function (response) {
        res.send(response)
    })
});

function setAllCoords(start, end, callback) {
    var start_coord = { lat: 0, lon: 0 };
    var end_coord = { lat: 0, lon: 0 };
    var start_query = helper.makeCoordsQuery(start);
    var end_query = helper.makeCoordsQuery(end);
    setCoords(start_coord, start_query, function (response) {
        if (response.status == 200) {
            setCoords(end_coord, end_query, function (response) {
                if (response.status == 200) {
                    callback({
                        message: `Please wait.`,
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
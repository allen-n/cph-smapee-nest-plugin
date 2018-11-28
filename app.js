const express = require('express')
const app = express()
const request = require('request')
var MongoClient = require('mongodb').MongoClient
const port = 3000
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs');
const https = require('https');

const { spawn } = require('child_process');

var globals = {
    session: {},
    service_locations: {},
    active_location_id: null,
    options_get_servicelocation: {
        url: 'https://app1pub.smappee.net/dev/v1/servicelocation',
        auth: {
            bearer: null
        }
    },
    scrape_interval_energy: 30000, // scrape for consumption data every 30 seconds
    appliances: {},
    scrape_interval_appliance: 86400000, //scrape for new appliances once a day
    first_row: true,
    num_appliances: -1,
    nest: {},
    prev_events: {},
    num_cols: 29
}

app.get('/printdb', (req, res) => {
    stream_all_mongodb((rstream) => {
        let csv = '';
        let i = 0;
        let max_row = globals.num_appliances + globals.num_cols + 1; //+1 is extra padding
        var wstream = fs.WriteStream(__dirname + '/data/cph_data.csv');
        var prev_events = Array(globals.num_appliances).fill(0);
        rstream.on('data', (doc) => {
            csv = i + ',';
            i += 1;
            [csv, prev_events] = row_to_csv(doc, csv, prev_events);
            csv = remove_csv_blanks(csv, max_row)
            if (!wstream.write(csv + '\r\n')) { //delay if buffer over its highwatermark
                rstream.pause();
                wstream.once('drain', () => {
                    rstream.resume();
                })
            }
        });
        rstream.once('end', () => {
            wstream.end();
            globals.prev_events = prev_events;
        });
        wstream.on('finish', () => {
            res.redirect('/downloads');
        })
    });
});

function row_to_csv(response, csv, prev_events) {
    var date;
    let mins;
    csv += response.srv_time + ',';
    date = new Date(response.srv_time);
    mins = (date.getHours()) * 60 + date.getMinutes();
    csv += date.getDay() + ',' + mins + ',';
    csv += energy_data_to_csv(response.energy);
    csv += thermostat_to_csv(response.thermostat);
    prev_events = appliance_events_to_csv(response.appliance, prev_events);
    csv += ',' + prev_events.join(',');
    return [csv, prev_events]
}

app.get('/downloads', (req, res) => {
    var my_html = '<button onclick="location.href = \'https://cyberpoweredhome.com:3000/printdb\'">Refresh List</button> \
    <button onclick="location.href = \'https://cyberpoweredhome.com:3000/download_data\';">Download CSV</button><br> \
    <button onclick="location.href = \'https://cyberpoweredhome.com:3000/download_ml\';">Download ML Data</button><br> \
    Index, Srv_Time,Day of week, mins into day, Timestamp, Total_Consumption, Active[main1, main2, main3, \
    c1,c2,c3,c4,c5,c6], Reactive[main1, main2, main3, c1,c2,c3,c4,c5,c6], humidity(%),ambient_temp(F), \
    fan(1/0), fan_timer_duration(min), thermostat_mode, target_temp(F), Appliance[id_0...id_n], <br>';
    res.send(my_html);
});

app.get('/download_data', (req, res) => {
    var file = __dirname + '/data/cph_data.csv';
    res.download(file); // Set disposition and send it.
    // res.redirect('/printdb')
});

app.get('/download_ml', (req, res) => {
    var file = __dirname + '/data/ML_predictions.csv';
    res.download(file); // Set disposition and send it.
    // res.redirect('/printdb')
});

app.get('/start', (req, res) => {
    let options_init_auth = {
        url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
        form: {
            grant_type: 'password',
            client_id: 'allennikka',
            client_secret: 'N3KEMfA0BJ',
            username: 'allennikka',
            password: 'Smap2Energy'
        }
    };

    request.post(options_init_auth, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }

        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
        res.redirect('/auth_success')
    });
});

app.get('/auth_success', (req, res) => {
    request.get(globals.options_get_servicelocation, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }

        globals.service_locations = JSON.parse(body).serviceLocations;
        globals.active_location_id = globals.service_locations[globals.service_locations.length - 1].serviceLocationId;

        res.redirect('/energy_scrape')
    });
});

app.get('/energy_scrape', (req, res) => {
    res.send('Done getting appliances. Check terminal window for more data.<br> <button onclick="location.href = \'https://cyberpoweredhome.com:3000/printdb\';">Click for DB</button>');
    re_appliance_scrape();
});

https.createServer({
    key: fs.readFileSync(__dirname + '/certs/server.key'),
    cert: fs.readFileSync(__dirname + '/certs/server.cert')
}, app)
    .listen(port, function () {
        console.log(`CPH-Interface app listening on port ${port}!`)
    })

function refresh_my_token() {
    let options = {
        url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
        form: {
            grant_type: 'refresh_token',
            refresh_token: globals.session.refresh_token,
            client_id: 'allennikka',
            client_secret: 'N3KEMfA0BJ'
        }
    };
    request.post(options, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }

        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
    });
}

function gen_get_appliances() {
    let options = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/info'
    options.auth.bearer = globals.session.access_token;
    return options;
}

function re_appliance_scrape() {
    let options_get_appliances = gen_get_appliances();
    request.get(options_get_appliances, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        var data = JSON.parse(body);
        globals.num_appliances = data.appliances.length;
        // console.log(data);
        //only do this on first run, timeouts will continue subsequent re_energy_scrape()
        if (globals.first_row) {
            globals.prev_events = Array(globals.num_appliances).fill(0);
            re_energy_scrape(); //Now that we have the total list of devices, look at device events
        }
        py_train_all((data) => {
            let date = Date.now()
            console.log('Model Retrained at:' + date.toString())
            // console.log(data);
        });
    });
    setTimeout(re_appliance_scrape, globals.scrape_interval_appliance);
}

function re_energy_scrape() {
    /*
    Scrape for energy and appliance events in last globals.scrape_interval_energy time period
    */
    let options_get_appliance_events = gen_get_appliance_events();
    let options_get_energy_data = gen_get_energy_data();
    let options_get_thermostat = gen_get_thermostat_data();
    let mongo_row = {};
    request.get(options_get_appliance_events, (err, httpResponse, body) => {
        mongo_row.appliance = appliance_events_req(body, err);
        request.get(options_get_energy_data, (err, httpResponse, body) => {
            energy_data_req(body, err, (energy_resp) => {
                mongo_row.energy = energy_resp;
                request.get(options_get_thermostat, (err, httpResponse, body) => {
                    try {
                        mongo_row.thermostat = (JSON.parse(body)).devices.thermostats;
                    } catch (error) {
                        console.log(error)
                    }
                    mongo_row.srv_time = Date.now();
                    insert_to_mongodb(mongo_row);
                    let data_str = row_to_csv(mongo_row, '', globals.prev_events);
                    data_str = '-1,' + data_str[0];
                    let max_row = globals.num_appliances + globals.num_cols + 1; //+1 is extra padding
                    data_str = remove_csv_blanks(data_str, max_row);
                    py_test_all(data_str, (output) => {
                        // console.log('py_test_all fired!')
                        output = mongo_row.srv_time + ',' + output;
                        fs.appendFile(__dirname + '/data/ML_predictions.csv', output, function (err) {
                            if (err) throw err;
                            // console.log('Saved!');
                        });
                    });
                });
            });
        });
    });
    setTimeout(re_energy_scrape, globals.scrape_interval_energy);
}

function remove_csv_blanks(csv, len = null) {
    let arr = csv.split(',')
    if (len == null) {
        len = arr.length
    }
    for (let i = 0; i < len; i++) {
        if (arr[i] == '' || typeof arr[i] == 'undefined') {
            arr[i] = '0';
        }
    }
    return arr.join(',')
}

function gen_get_appliance_events() {
    /*
    Generate options JSON for request.get() call to get 
    appliance events in last globals.scrape_interval_energy time period
     */
    let options = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/events?'
    options.auth.bearer = globals.session.access_token;
    for (p in globals.appliances) {
        let id = p.id;
        options.url += 'applianceId=' + id + '&';
    }
    let from = Date.now() - globals.scrape_interval_energy;
    let to = Date.now();
    options.url += 'maxNumber=100&';
    options.url += 'from=' + from + '&to=' + to;
    return options;
}

function gen_get_energy_data() {
    /*
    Generate options JSON for request.get() call to get 
    energy events in last globals.scrape_interval_energy time period
    */
    let options_get_energy_data = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options_get_energy_data.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/consumption'
    options_get_energy_data.auth.bearer = globals.session.access_token;
    let from = '';
    if (globals.first_row) {
        from = Date.now() - 1200000; //for first read, look back 20 minutes to make sure we get an event 
        globals.first_row = false;
    } else {
        from = Date.now() - 1200000;//360000; //globals.scrape_interval_energy; //check 6 minutes back
    }
    let to = Date.now();
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;
    // let diff = to - from;
    // console.log('To: ' + to + " From: " + from + " diff: " + diff);
    // console.log(options_get_energy_data.url);
    return options_get_energy_data;
}

function appliance_events_req(body, err) {
    /*
    Handle body and error returns from anonymous callback on
    request.get() to recieve appliance events, return
    array of appliance event json in index order
    */
    if (err) {
        return console.error('upload failed:', err);
    }
    var data = JSON.parse(body);

    let id_set = new Set();
    let recent_events = [];
    let csv = '';
    if (data.length > 0) {
        for (i in data) {
            if (!id_set.has(data[i].applianceId)) {
                id_set.add(data[i].applianceId);
                let my_id = data[i].applianceId;
                let my_obj = data[i];
                recent_events[my_id] = my_obj;
            }
        }
    }

    let null_event = { totalPower: null, activePower: null };
    for (let i = 0; i < globals.num_appliances; i++) {
        if (typeof recent_events[i] == 'undefined') {
            recent_events[i] = null_event;
        }
    }
    // appliance_events_to_csv(recent_events);    
    // console.log('Appliance Event Fetch Successful:', data);
    // console.log('Most Recent Event per Appliance csv:', csv);
    delete id_set;
    delete parser;

    return recent_events
}

function energy_data_req(body, err, callback) {
    /*
    Handle body and error returns from anonymous callback on
    request.get() to recieve energy events, return most recent 
    JSON object with previous energy data from smappee
    */
    if (err) {
        return console.error('upload failed:', err);
    }
    var data = JSON.parse(body);
    // console.log('energy data req:');
    // console.log(data);
    let last_data = null;
    if (data.consumptions.length > 0) {
        last_data = data.consumptions[data.consumptions.length - 1]
        callback(last_data);
    } else {
        get_latest_mongodb((error, response) => {
            // console.log('old data fetch ' + last_data);
            last_data = response.energy;
            callback(last_data);
        });
    }
    // console.log('Energy Use Event Fetch Successful::', data);
}

// function appliance_events_to_csv(recent_events, opts = { fields: ['totalPower', 'activePower'], header: false }) {
//     let csv = '';
//     const parser = new Json2csvParser(opts);
//     for (let i = 0; i < recent_events.length; i++) {
//         // if (recent_events[i] == null) {
//         //     csv += ',x';
//         // } else {
//         try {
//             csv += ',';
//             csv += parser.parse(recent_events[i]);
//         } catch (err) {
//             console.error(err);
//         }
//     }
//     // }
//     // if (recent_events.length == 0) {
//     //     for (let i = 0; i < globals.num_appliances; i++) {
//     //         csv += ',xs';

//     //     }
//     // }
//     return csv;
// }

function appliance_events_to_csv(recent_events, prev_events) {
    let csv = '';
    var sign;
    var out = [];
    for (let i = 0; i < recent_events.length; i++) {
        if (recent_events[i] != null && recent_events[i] != '') {
            sign = recent_events[i].activePower;
            if (sign != null) {
                if (sign > 0) {
                    out[i] = 2; //changed from (-1,1) to (1,2) for (off, on) to make neural net training easier
                } else {
                    out[i] = 1;
                }
            } else {
                out[i] = prev_events[i];
            }
        } else {
            recent_events[i] = 0;
        }
    }
    return out;
    // console.log(prev_events);
    // console.log(out);
    // console.log(out.toString())
    // return csv;
}

function energy_data_to_csv(last_data, opts = { fields: ['timestamp', 'consumption'], header: false }) {
    let csv = '';
    try {
        const parser = new Json2csvParser(opts);
        csv = parser.parse(last_data);
        csv = csv.concat(',', last_data.active.join(), ',', last_data.reactive.join());
        // console.log(csv);
        delete parser;
    } catch (err) {
        // console.error(err);
    }
    return csv
}

function insert_to_mongodb(json, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).insertOne(json, function (err, res) {
            if (err) throw err;
            // console.log("1 document inserted");
            db.close();
        });
    });
}

function get_latest_mongodb(callback, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    let last_val = null;
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).findOne({}, { sort: { $natural: -1 } }, (err, res) => {
            if (err) throw err;
            // console.log('Last event fetched from mongodb');
            callback(err, res)
        })
    });
}

function get_all_mongodb(callback, num_records = 100000, natural_order = false, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    let ord = -1;
    if (natural_order) {
        ord = 1;
    }
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).find({}, { sort: { $natural: ord } }).limit(num_records).toArray((err, res) => {
            if (err) throw err;
            // console.log('all events fetched from mongodb');
            // console.log(res);
            callback(res);
        });
    });
}

function stream_all_mongodb(callback, num_records = 100000, natural_order = false, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    let ord = -1;
    if (natural_order) {
        ord = 1;
    }
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        var col = dbo.collection(collection_name);
        var cursor = col.find({}, { sort: { $natural: ord } }).stream();
        callback(cursor);
        cursor.once('end', () => {
            db.close();
        });
    });
}

// get_all_mongodb((response) => {
//     let str = 'Done';
//     let csv = '';
//     let csv_arr = [];
//     let max_row = globals.num_appliances + globals.num_cols + 1; //+1 is extra padding
//     var wstream = fs.WriteStream(__dirname + '/data/cph_data.csv');

//     var prev_events = Array(globals.num_appliances).fill(0);
//     let tick = response.length / 100;
//     for (let i = response.length - 1; i >= 0; i--) {
//         csv = i + ',';
//         [csv, prev_events] = row_to_csv(response[i], csv, prev_events);
//         csv = remove_csv_blanks(csv, max_row)
//         wstream.write(csv + '\r\n');
//     }
//     wstream.end();
//     globals.prev_events = prev_events;
//     delete date;
//     wstream.on('finish', () => {
//         res.redirect('/downloads');
//     })
// });

app.get('/nest', (req, res) => {
    res.redirect('https://home.nest.com/login/oauth2?client_id=7ce5f2f9-1971-4933-b340-c7cba51bb7e5&state=STATE');
});

app.get('/nest_auth_success*', (req, res) => {
    let state = req.query.state;
    let my_code = req.query.code;
    var my_html = '<br><button onclick="location.href = \'https://cyberpoweredhome.com:3000/start\';">Click to Start</button>';
    let options_init_auth = {
        url: 'https://api.home.nest.com/oauth2/access_token',
        form: {
            client_id: '7ce5f2f9-1971-4933-b340-c7cba51bb7e5',
            client_secret: 'GuQLCuwXWkrjZg3CxjLTsT27k',
            grant_type: 'authorization_code',
            code: my_code
        }
    };

    request.post(options_init_auth, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Upload successful!  Server responded with:', body);
        globals.nest.session = JSON.parse(body);
        res.send("Code: " + my_code + ", State: " + state + "<br>Nest Auth Complete, start collecting data." + my_html);
        // get_thermostat_data();
        // setTimeout(refresh_my_token_nest, globals.nest.session.expires_in + 10)
        // res.redirect('/auth_success')
    });
});

function gen_get_thermostat_data() {
    let options = {
        url: 'https://developer-api.nest.com',
        auth: {
            bearer: null
        },
    };
    options.auth.bearer = globals.nest.session.access_token;
    return options;
}

function get_thermostat_data(callback = null) {
    /* Generate options JSON for request.get() call to get 
    energy events from Nest API, takes @callback as a param, 
    callback is an anonymous function that can take @csv as 
    an argument, which is a csv containing (ambient humidity (%), 
    ambient temp (F), fan (0=off, 1=on), fan timer duration,
    (min), target temperature (F)*/
    let options = {
        url: 'https://developer-api.nest.com', //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    options.auth.bearer = globals.nest.session.access_token;
    request.get(options, (err, httpResponse, body) => {
        // console.log(body)
        let data = JSON.parse(body);
        let csv = thermostat_to_csv(data);
        callback(csv);
        // console.log(csv)
        // console.log(thermostat_to_csv(data))
    });
}

function thermostat_to_csv(data, thermostat = '8OpZIwv1HR35Zb0XSJM8QwA9J-4dxXeB') {
    /* Function to take in the parsed JSON representing a response from
    the Nest API as @data, and taking an optional @thermostat argument 
    to specify which thermostat is being monitored. The output is a csv
    formatted datastring containing:
     (ambient humidity (%), ambient temp (F), fan (0=off, 1=on), fan timer duration,
     (min), target temperature (F) */
    let csv = '';
    // console.log(data);
    let my_tstat = data[thermostat];
    let mode = null;
    let target_temp = null;
    try {
        switch (my_tstat.hvac_mode) {
            case 'heat':
                mode = 1;
                target_temp = my_tstat.target_temperature_f;
                break;
            case 'cool':
                mode = 2;
                target_temp = my_tstat.target_temperature_f;
                break;
            case 'heat-cool':
                mode = 3;

                target_temp = get_target_temp(
                    my_tstat.ambient_temperature_f,
                    my_tstat.target_temperature_high_f,
                    my_tstat.target_temperature_low_f
                );
                break;
            case 'eco':
                mode = 4;
                target_temp = get_target_temp(
                    my_tstat.ambient_temperature_f,
                    my_tstat.eco_temperature_high_f,
                    my_tstat.eco_temperature_low_f
                );
                break;
            default:
                mode = 0;
                target_temp = my_tstat.ambient_temperature_f;
                break;
        }
        csv = my_tstat.humidity + ',' + my_tstat.ambient_temperature_f + ',';
        if (my_tstat.fan_timer_active) {
            csv += '1,' + my_tstat.fan_timer_duration + ',';
        } else {
            csv += '0,' + my_tstat.fan_timer_duration + ',';
        }
        csv += mode + ',' + target_temp;
    } catch (error) {
        throw error;
    }
    return csv;
}

function get_target_temp(ambient_temp, target_high, target_low) {
    /* Helper function for thermostat_to_csv() that takes ambient
    temperature and target high and low temps to return the target 
    temperature */
    if (ambient_temp > target_high) {
        return target_high
    } else if (ambient_temp < target_low) {
        return target_low
    } else {
        return ambient_temp;
    }
}

function py_test_all(data_str, callback) {
    data_str = data_str.toString();
    const pyProg = spawn('python', [__dirname + '/classifier.py', 'test-all', data_str]);
    pyProg.stderr.on('data', (err) => {
        pyProg.kill()
        console.log('Testing error!')
        console.log(err.toString())
    })

    pyProg.stdout.on("data", function (data) {
        callback(data.toString())
        // console.log(data.toString());
        // res.write(data);
        // res.end('end');
        pyProg.kill()
    });

    pyProg.on("close", (number, signal, string) => {
        // console.log(number, signal, string)
        // res.end('end2')
        pyProg.kill()
    })
}

function py_train_all(callback) {
    const pyProg = spawn('python', [__dirname + '/classifier.py', 'train-all']);
    pyProg.stderr.on('data', (err) => {
        pyProg.kill()
        console.log('Training error!')
        console.log(err.toString())
    })

    pyProg.stdout.on("data", function (data) {
        callback(data.toString())
        // console.log(data.toString());
        // res.write(data);
        // res.end('end');
        pyProg.kill()
    });

    pyProg.on("close", (number, signal, string) => {
        // console.log(number, signal, string)
        // res.end('end2')
        pyProg.kill()
    })
}
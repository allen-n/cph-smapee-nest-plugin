const express = require('express')
const app = express()
const request = require('request')
var MongoClient = require('mongodb').MongoClient
const port = 3000

// var mongo_url = "mongodb://localhost:27017/mydb";

// MongoClient.connect(mongo_url, (err, db) => {
//     if (err) throw err;
//     var dbo = db.db("mydb");
//     dbo.createCollection("sp_adata", (err, res) => {
//         if (err) throw err;
//         console.log("Collection created!");
//         db.close();
//     });
// });

let options_init_auth_honeywell = {
    url: 'https://api.honeywell.com/oauth2/authorize',
    form: {
        grant_type: 'code',
        client_id: 'OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv',
        redirect_uri: 'http://cyberpoweredhome.com',
    }
}
/**
*
Request from API login page:
Request URL: https://api.honeywell.com/oauth2/app/login?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com&app=cph-integration
Request Method: POST

requests after successful login, all made sequentially:
Request URL: https://api.honeywell.com/oauth2/app/consent?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&app=cph-integration&redirect_uri=http%3A%2F%2Fcyberpoweredhome.com
Request Method: POST

Request URL: https://api.honeywell.com/oauth2/app/acl?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&app=cph-integration&redirect_uri=http%3A%2F%2Fcyberpoweredhome.com
Request Method: GET

Request URL: http://cyberpoweredhome.com/?code=Ly0RxRYb&scope=
Request Method: GET
 * 
 */



app.get('/honeywell', (req, res) => {
    let honeywell_url = 'https://api.honeywell.com/oauth2/authorize?response_type=code&client_id=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com';
    res.redirect(honeywell_url);
    // request.post(honeywell_url, function optionalCallback(err, httpResponse, body) {
    //     if (err) {
    //         return console.error('upload failed:', err);
    //     }        
    //     // let data = JSON.parse(body);
    //     console.log('Upload successful!  Server responded with:', body);
    //     res.send('data')
    // });
});



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
    scrape_interval_energy: 600000, // scrape for consumption data every 10 minutes
    appliances: {},
    scrape_interval_appliance: 86400000, //scrape for new appliances once a day
}

app.get('/', (req, res) => {
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
        console.log('Upload successful!  Server responded with:', body);
        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
        res.redirect('/auth_success')
    });
});

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
        // console.log('Upload successful!  Server responded with:', body);
        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
    });
}

app.get('/auth_success', (req, res) => {
    request.get(globals.options_get_servicelocation, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Loc Request Successful!  Server responded with:', body);
        globals.service_locations = JSON.parse(body).serviceLocations;
        globals.active_location_id = globals.service_locations[globals.service_locations.length - 1].serviceLocationId;

        res.redirect('/energy_scrape')
    });
});

function parse_locations(body, err) {

}

app.get('/energy_scrape', (req, res) => {
    res.send('done');
    re_appliance_scrape();
    re_energy_scrape();
});

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
        console.log('Appliances data:', data.appliances);
    });
    setTimeout(re_appliance_scrape, globals.scrape_interval_appliance);
}

function gen_get_energy_data() {
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
    let from = Date.now() - globals.scrape_interval_energy;
    let to = Date.now();
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;
    return options_get_energy_data;
}

function re_energy_scrape() {
    let options_get_energy_data = gen_get_energy_data();
    request.get(options_get_energy_data, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        var data = JSON.parse(body);
        console.log('Loc Request Successful!  Server responded with:', data);
    });
    setTimeout(re_energy_scrape, globals.scrape_interval_energy);
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`))




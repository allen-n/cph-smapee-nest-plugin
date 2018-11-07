const express = require('express')
const app = express()
const request = require('request')
const port = 3000

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


const honeywell_url = 'https://api.honeywell.com/oauth2/authorize?response_type=code&client_id=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com';
app.get('/honeywell', (req, res) => {
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

var session = {};
var service_locations = {};

app.get('/', (req, res) => {
    request.post(options_init_auth, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
        session = JSON.parse(body);
        options_get_servicelocation.auth.bearer = session.access_token;
        res.redirect('/auth_success')
    });
});

var options_get_servicelocation = {
    url: 'https://app1pub.smappee.net/dev/v1/servicelocation',
    auth: {
        bearer: null
    }
}

app.get('/auth_success', (req, res) => {
    request.get(options_get_servicelocation, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Loc Request Successful!  Server responded with:', body);
        service_locations = JSON.parse(body).serviceLocations;
        // res.send(service_locations)
        res.redirect('/energy_scrape')
    });
});

var get_energy_data_interval = 60 * 10 * 1000; //in mseconds (10 mins)

var options_get_energy_data = {
    url: 'https://app1pub.smappee.net/dev/v1/servicelocation/', //[SERVICELOCATIONID]/events
    auth: {
        bearer: null
    },
};

app.get('/energy_scrape', (req, res) => {
    //configured to get last location, in this case the Smappee pro unit, update query
    options_get_energy_data.url += service_locations[service_locations.length - 1].serviceLocationId + '/consumption'
    options_get_energy_data.auth.bearer = session.access_token;
    let from = Date.now() - get_energy_data_interval;
    let to = Date.now()
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;

    request.get(options_get_energy_data, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Loc Request Successful!  Server responded with:', body);
        var data = JSON.parse(body);
        res.send(data)
        // res.redirect('/energy_scrape')
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))




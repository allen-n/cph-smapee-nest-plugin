const express = require('express')
const app = express()
const https = require('https')
const querystring = require('querystring')
const port = 3000

// Set the configuration settings
const credentials = {
    client: {
        id: 'allennikka',
        secret: 'N3KEMfA0BJ'
    },
    auth: {
        tokenHost: 'https://app1pub.smappee.net/dev/v1/oauth2/token'
    }
};

function authReqPost(){
    var form = {
        grant_type: 'password',
        client_id: 'allennikka',
        client_secret: 'N3KEMfA0BJ',
        username: 'allennikka',
        password: 'Smap2Energy'
    }
    
    var postData = querystring.stringify(form);
    var contentLength = postData.length;

    var options = {
        host: 'app1pub.smappee.net',
        port: 443,
        method: 'POST',
        path: '/dev/v1/oauth2/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': contentLength
        }
    };

    return [options, postData];
}
var crude_session = null;

function postRequest([options, postData], output) {
    // request option

    var myreq = https.request(options, function (resp) {
        var result = '';
        resp.on('data', function (chunk) {
            result += chunk;
        });
        resp.on('end', function () {
            var result_json = JSON.parse(result);
            output = result_json;
        });
        resp.on('error', function (err) {
            console.log(err);
        })
    });

    // req error
    myreq.on('error', function (err) {
        console.log(err);
    });

    //send request witht the postData form
    myreq.write(postData);
    myreq.end();
}

app.get('/getusers', function (req, res) {

});

app.get('/', (req, res) => {
    postRequest(authReqPost(), crude_session)
    res.send('DONE!')

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
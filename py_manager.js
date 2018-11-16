const express = require('express')
const app = express()

const { spawn } = require('child_process');
app.get('/', (req, res) => {

    var arr = '7336,1.54209E+12,1,1302,1.54209E+12,113.9,70.7,42.9,0,2.5,0.3,21.9,0.4,3.7,18.4,46.5,15.2,0,2.7,0.6,9.2,0.4,6,6.93,72,0,15,1,68,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0'
    const pyProg = spawn('python', [__dirname + '\\classifier.py', 'test-tree', arr]);

    pyProg.stderr.on('data', (data) => {
        throw data
    })

    pyProg.stdout.on("data", function(data) {

        console.log(data.toString());
        res.write(data);
        res.end('end');
        pyProg.kill()
    });

    pyProg.on("close", (number, signal, string) => {
        // console.log(number, signal, string)
        res.end('end2')
    })
})



app.listen(3000, () => console.log('Application listening on port 3000!'))
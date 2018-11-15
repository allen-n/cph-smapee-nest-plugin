const express = require('express')
const app = express()

const { spawn } = require('child_process');
app.get('/', (req, res) => {

    const pyProg = spawn('python', [__dirname + '\\classifier.py']);

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
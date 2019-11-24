import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import * as AWS from 'aws-sdk';

// load config
require('dotenv').config()

// init express
const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {

    ws.binaryType = 'arraybuffer';

    //connection is up, let's add a simple simple event
    ws.on('message', (message: any) => {
        if (typeof message !== 'string') {
            console.log(message);
            // init AWS credentials
            AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!, undefined);
            AWS.config.region = process.env.AWS_REGION!;

            // get Rekognition service reference
            const rekognition = new AWS.Rekognition({ apiVersion: '2016-06-27' });

            // prepare recognition params
            var recognitionDataParams = {
                Image: {
                    Bytes: arrayBufferToBuffer(message)
                },
                Attributes: ['ALL']
            };

            // detect face
            rekognition.detectFaces(recognitionDataParams, (err, data) => {
                if (err) {
                    console.log(err, err.stack); // an error occurred
                }
                else {
                    console.log(JSON.stringify(data));
                    // send back response
                    ws.send(JSON.stringify(data));
                }
            });
        } else {
            console.log('received string');
        }
    });
});

// ArrayBuffer conversion helpers
function arrayBufferToBufferAsArgument(ab: any) {
    return new Buffer(ab);
}

function arrayBufferToBufferCycle(ab: any) {
    var buffer = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

function arrayBufferToBuffer(buffer: any) {
    var isArrayBufferSupported = (new Buffer(new Uint8Array([1]).buffer)[0] === 1);
    if (isArrayBufferSupported) {
        return arrayBufferToBufferAsArgument(buffer);
    }
    else {
        return arrayBufferToBufferCycle(buffer);
    };
}

//start our server
server.listen(process.env.SERVER_PORT || 8991, () => {
    console.log(`Server started.`);
});
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import * as AWS from 'aws-sdk';

require('dotenv').config()

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

            AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!, undefined);
            AWS.config.region = process.env.AWS_REGION!;

            const lexConfig = {
                botName: process.env.AWS_LEX_BOT_NAME!,
                botAlias: process.env.AWS_LEX_BOT_ALIAS!,
                contentType: process.env.AWS_LEX_REQUEST_CONTENT_TYPE!,
                accept: process.env.AWS_LEX_RESPONSE_CONTENT_TYPE!,
                userId: process.env.AWS_LEX_USER_ID!,
                inputStream: arrayBufferToBuffer(message)
            };

            const lexRuntime = new AWS.LexRuntime();
            lexRuntime.postContent(lexConfig, function (err: any, lexResponse: any) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(lexResponse);
                    ws.send(JSON.stringify(lexResponse));
                }
            });

        } else {
            console.log('received string');
        }
    });
});

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
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto'; // tot sign our pre-signed URL
import Signature from './aws-signature-v4'; // to generate our pre-signed URL
import * as marshaller from "@aws-sdk/eventstream-marshaller"; // for converting binary event stream messages to and from JSON
import * as util_utf8_node from "@aws-sdk/util-utf8-node"; // utilities for encoding and decoding UTF8

require('dotenv').config()

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

// our global variables for managing state
let languageCode = process.env.AWS_TRANSCRIBE_LANGUAGE_CODE;
let access_id = process.env.AWS_ACCESS_KEY_ID;
let secret_key = process.env.AWS_SECRET_ACCESS_KEY;
let region = process.env.AWS_REGION;
let outputSampleRate = process.env.AWS_TRANSCRIBE_OUTPUT_SAMPLE_RATE;
let transcription = "";
let inbound_socket: WebSocket;
let outbound_socket: WebSocket;
let socketError = false;
let transcribeException = false;

// Pre-signed URLs are a way to authenticate a request (or WebSocket connection, in this case)
// via Query Parameters. Learn more: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
function createPresignedUrl() {
    let endpoint = "transcribestreaming." + region + ".amazonaws.com:8443";
    const v4 = new Signature();

    // get a preauthenticated URL that we can use to establish our WebSocket
    const url = v4.createPresignedURL(
        'GET',
        endpoint,
        '/stream-transcription-websocket',
        'transcribe',
        crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
        'key': access_id,
        'secret': secret_key,
        'protocol': 'wss',
        'expires': 15,
        'region': region,
        'query': "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + outputSampleRate
    }
    );

    return url;
}

function handleEventStreamMessage(messageJson: any) {
    let results = messageJson.Transcript.Results;

    if (results.length > 0) {
        if (results[0].Alternatives.length > 0) {
            let transcript = results[0].Alternatives[0].Transcript;
            // fix encoding for accented characters
            transcript = decodeURIComponent(escape(transcript));

            // if this transcript segment is final, add it to the overall transcription
            if (!results[0].IsPartial) {
                transcription += transcript + "\n";
                const response = JSON.stringify({
                    transcript: transcription
                });
                console.log(response);
                inbound_socket.send(response);
            }
        }
    }
}

function closeSocket() {
    if (outbound_socket.OPEN) {
        // Send an empty frame so that Transcribe initiates a closureof the WebSocket after submitting all transcripts
        let emptyMessage: any;
        emptyMessage = getAudioEventMessage(Buffer.from(new Buffer([])));

        let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
        outbound_socket.send(emptyBuffer);
    }
}

function wireSocketEvents() {
    // handle inbound messages from Amazon Transcribe
    outbound_socket.onmessage = function (message: any) {
        //convert the binary event stream message to JSON
        let messageWrapper = eventStreamMarshaller.unmarshall(new Buffer(message.data));
        let array = Array.from(messageWrapper.body);
        let messageBody = JSON.parse(String.fromCharCode.apply(String, array));
        if (messageWrapper.headers[":message-type"].value === "event") {
            handleEventStreamMessage(messageBody);
        }
        else {
            transcribeException = true;
            console.log('Transcribe exception: ' + messageBody.Message);
        }
    };

    outbound_socket.onerror = function (e: any) {
        socketError = true;
        console.log('Outbound socket error:' + e);
    };

    outbound_socket.onclose = function (closeEvent: WebSocket.CloseEvent) {
        console.log('Outbound socket closed:' + closeEvent.code + ', ' + closeEvent.reason);

        // the close event immediately follows the error event; only handle one.
        if (!socketError && !transcribeException) {
            if (closeEvent.code != 1000) {
                console.log('Outbound socket closed with error:' + closeEvent.code + ', ' + closeEvent.reason);
            }
        }
    };
}

// https://stackoverflow.com/questions/55073003/amazon-transcribe-streaming-service-request-in-node-js-with-http-2-gives-no-resp
wss.on('connection', (ws: WebSocket) => {

    inbound_socket = ws;
    inbound_socket.binaryType = 'arraybuffer';

    //open up our WebSocket connection
    let transcribe_url = createPresignedUrl();
    outbound_socket = new WebSocket(transcribe_url);
    outbound_socket.binaryType = "arraybuffer";

    // handle messages, errors, and close events
    wireSocketEvents();

    // when we get audio data from the mic, send it to the WebSocket if possible
    outbound_socket.onopen = function () {
        console.log('Outbound AWS Transcribe connection openned.');

        //connection is up, let's add a simple simple event
        inbound_socket.on('message', (message: any) => {
            if (typeof message !== 'string') {
                // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
                const transcribeRequest = convertAudioToBinaryMessage(message);

                if (outbound_socket.OPEN) {
                    outbound_socket.send(transcribeRequest);
                }
            } else {
                console.log('received: %s');
            }
        });
    };
});

function convertAudioToBinaryMessage(buffer: any) {
    // add the right JSON headers and structure to the message
    const audioEventMessage = getAudioEventMessage(Buffer.from(buffer));

    //convert the JSON object + headers into a binary event stream message
    const binary = eventStreamMarshaller.marshall(audioEventMessage);
    return binary;
}

function getAudioEventMessage(buffer: any) {
    // wrap the audio data in a JSON envelope
    let audioEventMessage: marshaller.Message;
    audioEventMessage = {
        headers: {
            ':content-type': {
                type: 'string',
                value: 'application/octet-stream'
            },
            ':event-type': {
                type: 'string',
                value: 'AudioEvent'
            },
            ':message-type': {
                type: 'string',
                value: 'event'
            }
        },
        body: buffer
    };
    return audioEventMessage;
}

//start our server
server.listen(process.env.SERVER_PORT || 8990, () => {
    console.log(`Server started.`);
});
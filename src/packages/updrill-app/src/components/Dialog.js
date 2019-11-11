import React, { Component } from 'react';
import ClipPlayer from './ClipPlayer.js';
import SpeechRecorder from './SpeechRecorder.js';
import { exportBufferLex } from '../utilities/converter-lex'
import { exportBufferTranscribe } from '../utilities/converter-transcribe'

// -----------------------------------

import 'video.js/dist/video-js.css';
import videojs from 'video.js';

import 'webrtc-adapter';
import RecordRTC from 'recordrtc';

// register videojs-record plugin with this import
import 'videojs-record/dist/css/videojs.record.css';
import Record from 'videojs-record/dist/videojs.record.js';

// -----------------------------------

const URL_INTENT = 'ws://localhost:8991'
const URL_TRANSCRIBE = 'ws://localhost:8990'

const videoJsOptions = {
    controls: false,
    width: 320,
    height: 240,
    fluid: false,
    controlBar: {
        volumePanel: false
    },
    plugins: {
        record: {
            audio: false,
            video: true,
            maxLength: 10,
            debug: true
        }
    }
};

class Dialog extends Component {

    transcript = '';

    constructor(props) {
        super(props);
        this.state = {
            clip: null,
            speech: null
        }

        this.ws_intent = new WebSocket(URL_INTENT);
        this.ws_transcribe = new WebSocket(URL_TRANSCRIBE);

        this.isReady = false;
    }

    async componentDidMount() {
        try {
            // ---------------
            // instantiate Video.js
            this.player = videojs(this.videoNode, videoJsOptions, () => {
                // print version information at startup
                var version_info = 'Using video.js ' + videojs.VERSION +
                    ' with videojs-record ' + videojs.getPluginVersion('record') +
                    ' and recordrtc ' + RecordRTC.version;
                videojs.log(version_info);

                this.player.record().getDevice();

                // device is ready
                this.player.on('deviceReady', () => {
                    console.log('device is ready!');
                    this.isReady = true;

                    /*console.log('Recording type: ' + this.player.record().getRecordType());
                    console.log('Recoridng: ' + this.player.record().isRecording());
                    console.log('Starting recording...');

                    this.player.record().start();
                    console.log('Recoridng: ' + this.player.record().isRecording());
                    console.log('Stopping recording...');
                    //this.player.record().stopDevice();
                    this.player.record().stop();
                    console.log('Recoridng: ' + this.player.record().isRecording());*/
                });

                // user clicked the record button and started recording
                this.player.on('startRecord', () => {
                    console.log('started recording!');
                });

                // user completed recording and stream is available
                this.player.on('finishRecord', () => {
                    // recordedData is a blob object containing the recorded data that
                    // can be downloaded by the user, stored on server etc.
                    console.log('finished recording: ', this.player.recordedData);
                });

                // error handling
                this.player.on('error', (element, error) => {
                    console.warn(error);
                });

                this.player.on('deviceError', () => {
                    console.error('device error:', this.player.deviceErrorCode);
                });
                // ---------------

                // wire intent server events
                this.ws_intent.onopen = () => {
                    this.startSpeechRecording();
                }
                this.ws_intent.onmessage = evt => {
                    this.handleIntentResponse(JSON.parse(evt.data));
                }
                this.ws_intent.onclose = () => {
                    // automatically try to reconnect on connection loss
                    this.ws_intent = new WebSocket(URL_INTENT);
                }

                // wire transcribe server events
                this.ws_transcribe.onopen = () => {

                }
                this.ws_transcribe.onmessage = evt => {
                    this.handleTranscribeResponse(JSON.parse(evt.data));
                }
                this.ws_transcribe.onclose = () => {
                    // automatically try to reconnect on connection loss
                    this.ws_transcribe = new WebSocket(URL_TRANSCRIBE);
                }

            });


        } catch (error) {
            // Users browser doesn't support audio.
            // Add your handler here.
            console.log(error);
        }
    }

    // destroy player on unmount
    componentWillUnmount() {
        if (this.player) {
            this.player.dispose();
        }
    }

    render() {
        // console.log(JSON.stringify(this.state, null, 4));

        let clipPlayer;
        const { clip } = this.state;
        if (clip) {
            clipPlayer = <ClipPlayer clip={clip} />;
        }

        let speechRecorder;
        const { speech } = this.state;
        if (speech) {
            speechRecorder = <SpeechRecorder
                speech={speech}
                handleRecordedSpeech={(buffer) => this.handleRecordedSpeech(buffer)}
                handleDetectedSilence={() => this.handleDetectedSilence()}
                handleRecordedChunk={(buffer) => this.handleRecordedChunk(buffer)}
            />
        }

        return (
            <div className="dialog">
                {clipPlayer}
                {speechRecorder}
                <div className="mic-control">
                    <p className="white-circle" onClick={() => this.stopSpeechRecording()}>
                        <img id="mic-icon" src="mic-blue.png" width="60" height="64" alt="" />
                    </p>
                </div>

                <div data-vjs-player>
                    <video id="myVideo" ref={node => this.videoNode = node} className="video-js vjs-default-skin" playsInline></video>
                </div>
            </div>
        );
    }

    startSpeechRecording() {
        console.log('Recording started');
        if(this)
        
        this.setState({ clip: null, speech: { recording: true } });
    }

    stopSpeechRecording() {
        console.log('Recording stopped');
        if (this.isReady) {
            if(this.player.record().isRecording()) {
                this.player.record().stop();
            } else {
                this.player.record().start();
            } 
        }
        this.setState({ clip: null, speech: { recording: false } });
    }

    handleDetectedSilence() {
        console.log('Silence detected');
        this.stopSpeechRecording();
    }

    handleRecordedSpeech(buffer) {
        const exportedBuffer = exportBufferLex(buffer[0]);
        this.ws_intent.send(exportedBuffer);
    }

    handleRecordedChunk(buffer) {
        const exportedBuffer = exportBufferTranscribe(buffer[0]);
        this.ws_transcribe.send(exportedBuffer)
    }

    handleIntentResponse(data) {
        console.log('Detected intent: ' + data.intentName);
        console.log('Lex trascript: ' + data.inputTranscript);

        console.log('Clip playback started')
        this.setState({
            clip: {
                url: data.sessionAttributes.currentClip,
                playing: true,
                loop: false,
                volume: 1,
                onEnded: this.handleClipPlaybackEnded.bind(this)
            },
            speech: null
        });
    }

    handleTranscribeResponse(data) {
        console.log('Transcribe transcript: ' + data.transcript);
    }

    handleClipPlaybackEnded() {
        console.log('Clip playback stopped')
        this.startSpeechRecording();
    }
}

export default Dialog;
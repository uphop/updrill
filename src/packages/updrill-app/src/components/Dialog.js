import React, { Component } from 'react';
import ClipPlayer from './ClipPlayer.js';
import SpeechRecorder from './SpeechRecorder.js';
import FaceSnapshot from './FaceSnapshot.js';
import { exportBufferLex } from '../utilities/converter-lex';
import { exportBufferTranscribe } from '../utilities/converter-transcribe';

class Dialog extends Component {

    constructor(props) {
        super(props);

        // init state
        this.state = {
            clip: null,
            speech: null,
            transcript: null,
            snapshot: false
        }
    }

    async componentDidMount() {
        try {
            this.initIntent();
            this.initTranscribe();
            this.initRecognize();
        } catch (error) {
            // Users browser doesn't support audio.
            // Add your handler here.
            console.log(error);
        }
    }

    componentWillUnmount() {

    }

    render() {
        console.log(JSON.stringify(this.state, null, 4));

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

        let faceSnapshot;
        const { snapshot } = this.state;
        if (snapshot) {
            faceSnapshot = <FaceSnapshot
                handleSnapshot={(buffer) => this.handleSnapshot(buffer)} />;
        }

        return (
            <div className="dialog">
                {clipPlayer}
                {speechRecorder}
                {faceSnapshot}
            </div>
        );
    }

    initIntent() {
        // init socket
        this.ws_intent = new WebSocket(process.env.REACT_APP_URL_INTENT);

        // wire intent server events
        this.ws_intent.onopen = () => {
            this.startSpeechRecording();
        }
        this.ws_intent.onmessage = evt => {
            this.handleIntentResponse(JSON.parse(evt.data));
        }
        this.ws_intent.onclose = () => {
            // automatically try to reconnect on connection loss
            this.ws_intent = new WebSocket(process.env.REACT_APP_URL_INTENT);
        }
    }

    initTranscribe() {
        // init socket
        this.ws_transcribe = new WebSocket(process.env.REACT_APP_URL_TRANSCRIBE);

        // wire transcribe server events
        this.ws_transcribe.onopen = () => {

        }
        this.ws_transcribe.onmessage = evt => {
            this.handleTranscribeResponse(JSON.parse(evt.data));
        }
        this.ws_transcribe.onclose = () => {
            // automatically try to reconnect on connection loss
            this.ws_transcribe = new WebSocket(process.env.REACT_APP_URL_TRANSCRIBE);
        }
    }

    initRecognize() {
        // init socket
        this.ws_recognize = new WebSocket(process.env.REACT_APP_URL_RECOGNIZE);

        // wire recognize server events
        this.ws_recognize.onopen = () => {
            this.startSnapshotShooting();
        }
        this.ws_recognize.onmessage = evt => {
            this.handleRecognizeResponse(JSON.parse(evt.data))
        }
        this.ws_recognize.onclose = () => {
            // automatically try to reconnect on connection loss
            this.ws_recognize = new WebSocket(process.env.REACT_APP_URL_RECOGNIZE);
        }
    }

    startSnapshotShooting() {
        console.log('Shooting started');
        this.setState({ snapshot: { shooting: true } });
    }

    stopSnapshotShooting() {
        console.log('Shooting stopped');
        this.setState({ snapshot: { shooting: false } });
    }

    startSpeechRecording() {
        console.log('Recording started');
        this.setState({ clip: null, speech: { recording: true } });
    }

    stopSpeechRecording() {
        console.log('Recording stopped');
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
        this.ws_transcribe.send(exportedBuffer);
    }

    handleSnapshot(buffer) {
        this.ws_recognize.send(buffer);
    };

    handleIntentResponse(data) {
        console.log('Detected intent: ' + data.intentName);

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
        /*let { transcript } = this.state;
        if (!transcript) transcript = '';

        transcript +=  data.transcript;
        transcript +=  '\r\n';
        this.setState({transcript: transcript });*/
    }

    handleRecognizeResponse(data) {
        console.log('Emotions detected');
        const faceDetails = data.FaceDetails[0];
        const faceHistory = {
            smile: faceDetails.Smile,
            emotions: faceDetails.Emotions
        };

        //console.log('Recognize response: ' + JSON.stringify(faceHistory, null, 4));
    }

    handleClipPlaybackEnded() {
        console.log('Clip playback stopped')
        this.startSpeechRecording();
    }
}

export default Dialog;
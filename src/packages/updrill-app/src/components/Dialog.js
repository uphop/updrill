import React, { Component } from 'react';
import ClipPlayer from './ClipPlayer.js';
import SpeechRecorder from './SpeechRecorder.js';
import { exportBufferLex } from '../utilities/converter-lex'
import { exportBufferTranscribe } from '../utilities/converter-transcribe'

const URL_INTENT = 'ws://localhost:8991'
const URL_TRANSCRIBE = 'ws://localhost:8990'

class Dialog extends Component {

    ws_intent = new WebSocket(URL_INTENT);
    ws_transcribe = new WebSocket(URL_TRANSCRIBE);

    transcript = '';

    constructor(props) {
        super(props);
        this.state = {
            clip: null,
            speech: null
        }
    }

    async componentDidMount() {
        try {
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
        } catch (error) {
            // Users browser doesn't support audio.
            // Add your handler here.
            console.log(error);
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
            </div>
        );
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
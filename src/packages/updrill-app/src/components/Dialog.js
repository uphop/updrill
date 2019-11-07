import React, { Component } from 'react';
import ClipPlayer from './ClipPlayer.js';
import SpeechRecorder from './SpeechRecorder.js';

const URL = 'ws://localhost:8999'

class Dialog extends Component {

    ws = new WebSocket(URL)

    constructor(props) {
        super(props);
        this.state = {
            clip: null,
            speech: null
        }
    }

    async componentDidMount() {
        try {
            this.ws.onopen = () => {
                this.startSpeechRecording();
            }
            this.ws.onmessage = evt => {
                this.handleLexResponse(JSON.parse(evt.data));
            }
            this.ws.onclose = () => {
                // automatically try to reconnect on connection loss
                this.setState({
                    ws: new WebSocket(URL),
                })
            }
        } catch (error) {
            // Users browser doesn't support audio.
            // Add your handler here.
            console.log(error);
        }
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
                handleRecordedSpeech={(audio) => this.handleRecordedSpeech(audio)}
                handleDetectedSilence={() => this.handleDetectedSilence()}
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
        this.setState({ speech: { recording: true } });
    }

    stopSpeechRecording() {
        this.setState({ speech: { recording: false } });
    }

    handleDetectedSilence() {
        this.setState({ speech: { recording: false } });
    }

    handleRecordedSpeech(audio) {
        this.ws.send(audio);
    }

    handleLexResponse(lexResponse) {
        this.setState({
            clip: {
                url: lexResponse.sessionAttributes.currentClip,
                playing: true,
                loop: false,
                volume: 1,
                onEnded: this.handleClipPlaybackEnded.bind(this)
            },
            speech: null
        });
    }

    handleClipPlaybackEnded() {
        this.startSpeechRecording();
    }
}

export default Dialog;
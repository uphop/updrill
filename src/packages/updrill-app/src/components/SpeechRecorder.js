import React, { Component } from 'react';
import Recorder from '../utilities/recorder';

class SpeechRecorder extends Component {

  constructor(props) {
    super(props);
    this.state = {
      stream: null,
      recorder: null,
      speech: null
    };

    this.handleDetectedSilence = this.props.handleDetectedSilence;
    this.handleRecordedChunk = this.props.handleRecordedChunk;
  }

  async componentDidMount() {
    try {
      const recorder = new Recorder({ onSilence: this.handleDetectedSilence, onAudio: this.handleRecordedChunk });
      recorder.init().then(() => { this.setState({ recorder }); });
    } catch (error) {
      // Users browser doesn't support audio.
      // Add your handler here.
      console.log(error);
    }
  }

  startRecord() {
    const { recorder } = this.state;
    recorder.start();
  }

  async stopRecord() {
    const { recorder } = this.state;
    const audio = await recorder.stop();
    return audio;
  }

  render() {
    const { recorder } = this.state;
    if (!recorder) {
      return null;
    }

    const { speech } = this.props;
    if (speech.recording) {
      this.startRecord();
    } else {
      this.stopRecord()
        .then((buffer) => {
          this.props.handleRecordedSpeech(buffer);
        })
        .catch((error) => console.log(error));
    }

    return (
      <div className='recorder-wrapper'>
      </div>
    );
  }
}

export default SpeechRecorder;

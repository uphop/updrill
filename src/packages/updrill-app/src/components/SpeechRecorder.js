import React, { Component } from 'react';
import Recorder from '../utilities/recorder';
// import { getAudioStream } from '../utilities/audio';

class SpeechRecorder extends Component {

  constructor(props) {
    super(props);
    this.state = {
      stream: null,
      recorder: null,
      speech: null
    };

    this.handleDetectedSilence = this.props.handleDetectedSilence;
  }

  async componentDidMount() {
    try {
      const recorder = new Recorder({ onSilence: this.handleDetectedSilence });
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
    const { buffer, blob } = await recorder.stop();
    return blob;
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
        .then((blob) => {
          this.props.handleRecordedSpeech(blob);
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

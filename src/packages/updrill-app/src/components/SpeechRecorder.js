import React, { Component } from 'react';
import Recorder from '../utilities/recorder';
import { getAudioStream, exportBuffer } from '../utilities/audio';

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
      const stream = await getAudioStream();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const recorder = new Recorder(audioContext, { onSilence: this.handleDetectedSilence });
      recorder.init(stream);
      this.setState({ stream, recorder });
    } catch (error) {
      // Users browser doesn't support audio.
      // Add your handler here.
      console.log(error);
    }
  }

  startRecord() {
    console.log('Recording started');
    const { recorder } = this.state;
    recorder.start();
  }

  async stopRecord() {
    console.log('Recording stopped');
    const { recorder } = this.state;
    const { buffer } = await recorder.stop()
    const audio = exportBuffer(buffer[0]);
    return audio;
  }

  render() {
    const { stream } = this.state;
    if (!stream) {
      return null;
    }

    const { speech } = this.props;
    if (speech.recording) {
      this.startRecord();
    } else {
      this.stopRecord()
        .then((audio) => this.props.handleRecordedSpeech(audio))
        .catch((error) => console.log(error));
    }

    return (
      <div className='recorder-wrapper'>
      </div>
    );
  }
}

export default SpeechRecorder;

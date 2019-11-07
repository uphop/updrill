import Microphone from './microphone';

const defaultConfig = {
  onSilence: null
};

class Recorder {
  constructor(audioContext, config = {}) {
    this.config = Object.assign({}, defaultConfig, config);

    this.audioContext = audioContext;
    this.audioSource = null;
    this.audioRecorder = null;
    this.stream = null;
  }

  init(stream) {
    return new Promise((resolve) => {
      // https://github.com/ijsnow/studiojs/blob/master/recorder/src/index.js
      // https://sonoport.github.io/visualising-waveforms-with-web-audio.html
      this.stream = stream;
      this.audioSource = this.audioContext.createMediaStreamSource(this.stream);
      this.audioRecorder = new Microphone(this.audioSource, { onSilence: this.config.onSilence });

      resolve();
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      if (!this.audioRecorder) {
        reject('Not currently recording');
        return;
      }

      this.audioRecorder.clear();
      this.audioRecorder.record();

      resolve(this.stream);
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.audioRecorder.stop();

      this.audioRecorder.getBuffer((buffer) => {
        this.audioRecorder.exportWAV(blob => resolve({ buffer, blob }));
      });
    });
  }
}

Recorder.download = function download(blob, filename = 'audio') {
  Microphone.forceDownload(blob, `${filename}.wav`);
};

export default Recorder;

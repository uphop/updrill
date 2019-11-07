import Microphone from './microphone';

class Recorder {
  constructor(config = {}) {
    this.config = config;
    this.audioContext = null;
    this.audioSource = null;
    this.audioRecorder = null;
    this.stream = null;
  }

  init() {
    return new Promise((resolve) => {
      // https://github.com/ijsnow/studiojs/blob/master/recorder/src/index.js
      // https://sonoport.github.io/visualising-waveforms-with-web-audio.html
      this.stream = this.getAudioStream();
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioSource = this.audioContext.createMediaStreamSource(this.stream);
      this.audioRecorder = new Microphone(this.audioSource, { onSilence: this.config.onSilence });

      resolve();
    });
  }

  /**
 * Get access to the users microphone through the browser.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Using_the_new_API_in_older_browsers
 */
  getAudioStream() {
    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }

    // Some browsers partially implement mediaDevices. We can't just assign an object
    // with getUserMedia as it would overwrite existing properties.
    // Here, we will just add the getUserMedia property if it's missing.
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        // First get ahold of the legacy getUserMedia, if present
        var getUserMedia =
          navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if (!getUserMedia) {
          return Promise.reject(
            new Error('getUserMedia is not implemented in this browser')
          );
        }

        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function (resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }

    const params = { audio: true, video: false };

    return navigator.mediaDevices.getUserMedia(params);
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

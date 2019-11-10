/* eslint-disable */
/**
 * License (MIT)
 *
 * Copyright © 2013 Matt Diamond
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
import InlineWorker from 'inline-worker';

const defaultConfig = {
  bufferLen: 4096,
  numChannels: 2,
  sampleRate: 44100,
  mimeType: 'audio/wav',
  onSilence: null
};

class Microphone {
  constructor(source, config) {
    this.config = Object.assign({}, defaultConfig, config);
    this.recording = false;

    this.callbacks = {
      getBuffer: [],
      exportWAV: []
    };

    this.context = source.context;
    this.node = this.context.createScriptProcessor(this.config.bufferLen, this.config.numChannels, this.config.numChannels);

    this.node.onaudioprocess = (e) => {
      if (!this.recording) return;

      let buffer = [];
      for (let channel = 0; channel < this.config.numChannels; channel++) {
        buffer.push(e.inputBuffer.getChannelData(channel));
      }

      this.worker.postMessage({
        command: 'record',
        buffer: buffer
      });

      this.broadcastAudioChunk(buffer);
      this.analyseSilence();
    };

    this.silenceAnalyser = this.context.createAnalyser();
    this.silenceAnalyser.fftSize = this.config.bufferLen;
    this.silenceAnalyser.minDecibels = -90;
    this.silenceAnalyser.maxDecibels = -10;
    this.silenceAnalyser.smoothingTimeConstant = 0.85;
    this.silenceStartTime = null;

    source.connect(this.silenceAnalyser);
    this.silenceAnalyser.connect(this.node);
    this.node.connect(this.context.destination);

    /**
    * Checks the time domain data to see if the amplitude of the audio waveform is more than
    * the silence threshold. If it is, "noise" has been detected and it resets the start time.
    * If the elapsed time reaches the time threshold the silence callback is called. If there is a 
    * visualizationCallback it invokes the visualization callback with the time domain data.
    */
    this.analyseSilence = function () {
      if (this.config.onSilence) {
        var bufferLength = this.silenceAnalyser.fftSize;
        var dataArray = new Uint8Array(bufferLength);
        var amplitude = 0.2;
        var time = 1500;

        this.silenceAnalyser.getByteTimeDomainData(dataArray);

        for (let i = 0; i < bufferLength; i++) {
          // Normalize between -1 and 1.
          const curr_value_time = (dataArray[i] / 128) - 1.0;
          if (curr_value_time > amplitude || curr_value_time < (-1 * amplitude)) {
            this.silenceStartTime = Date.now();
          }
        }
        const newtime = Date.now();
        const elapsedTime = newtime - this.silenceStartTime;
        if (elapsedTime > time) {
          this.config.onSilence();
        }
      }
    };

    this.broadcastAudioChunk = function (buffer) {
      if (this.config.onAudio) { 
        this.config.onAudio(buffer); 
      }
    }

    let self = {};
    this.worker = new InlineWorker(function () {
      let recLength = 0,
        recBuffers = [],
        sampleRate,
        numChannels;

      this.onmessage = function (e) {
        switch (e.data.command) {
          case 'init':
            init(e.data.config);
            break;
          case 'record':
            record(e.data.buffer);
            break;
          case 'exportWAV':
            exportWAV(e.data.type);
            break;
          case 'getBuffer':
            getBuffer();
            break;
          case 'clear':
            clear();
            break;
        }
      };

      function init(config) {
        sampleRate = config.sampleRate;
        numChannels = config.numChannels;
        initBuffers();
      }

      function record(inputBuffer) {
        for (var channel = 0; channel < numChannels; channel++) {
          recBuffers[channel].push(inputBuffer[channel]);
        }
        recLength += inputBuffer[0].length;
      }

      function exportWAV(type) {
        let buffers = [];
        for (let channel = 0; channel < numChannels; channel++) {
          buffers.push(mergeBuffers(recBuffers[channel], recLength));
        }
        let interleaved;
        if (numChannels === 2) {
          interleaved = interleave(buffers[0], buffers[1]);
        } else {
          interleaved = buffers[0];
        }
        let dataview = encodeWAV(interleaved);
        let audioBlob = new Blob([dataview], { type: type });

        this.postMessage({ command: 'exportWAV', data: audioBlob });
      }

      function getBuffer() {
        let buffers = [];
        for (let channel = 0; channel < numChannels; channel++) {
          buffers.push(mergeBuffers(recBuffers[channel], recLength));
        }
        this.postMessage({ command: 'getBuffer', data: buffers });
      }

      function clear() {
        recLength = 0;
        recBuffers = [];
        initBuffers();
      }

      function initBuffers() {
        for (let channel = 0; channel < numChannels; channel++) {
          recBuffers[channel] = [];
        }
      }

      function mergeBuffers(recBuffers, recLength) {
        let result = new Float32Array(recLength);
        let offset = 0;
        for (let i = 0; i < recBuffers.length; i++) {
          result.set(recBuffers[i], offset);
          offset += recBuffers[i].length;
        }
        return result;
      }

      function interleave(inputL, inputR) {
        let length = inputL.length + inputR.length;
        let result = new Float32Array(length);

        let index = 0,
          inputIndex = 0;

        while (index < length) {
          result[index++] = inputL[inputIndex];
          result[index++] = inputR[inputIndex];
          inputIndex++;
        }
        return result;
      }

      function floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++ , offset += 2) {
          let s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      }

      function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i += 1) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      function encodeWAV(samples) {
        const buffer = new ArrayBuffer(44 + (samples.length * 2));
        const view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + (samples.length * 2), true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        floatTo16BitPCM(view, 44, samples);

        return view;
      }
    }, self);

    this.worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: this.config.numChannels,
      },
    });

    this.worker.onmessage = (e) => {
      const cb = this.callbacks[e.data.command].pop();
      if (typeof cb === 'function') {
        cb(e.data.data);
      }
    };
  }

  record() {
    this.silenceStartTime = Date.now();
    this.recording = true;
  }

  stop() {
    this.recording = false;
  }

  clear() {
    this.worker.postMessage({ command: 'clear' });
  }

  getBuffer(cb) {
    cb = cb || this.config.callback;

    if (!cb) throw new Error('Callback not set');

    this.callbacks.getBuffer.push(cb);

    this.worker.postMessage({ command: 'getBuffer' });
  }

  exportWAV(cb, mimeType) {
    mimeType = mimeType || this.config.mimeType;
    cb = cb || this.config.callback;

    if (!cb) throw new Error('Callback not set');

    this.callbacks.exportWAV.push(cb);

    this.worker.postMessage({
      command: 'exportWAV',
      type: mimeType,
    });
  }
}

Microphone.forceDownload = function forceDownload(blob, filename) {
  const a = document.createElement('a');

  a.style = 'display: none';
  document.body.appendChild(a);

  var url = window.URL.createObjectURL(blob);

  a.href = url;
  a.download = filename;
  a.click();

  window.URL.revokeObjectURL(url);

  document.body.removeChild(a);
};

export default Microphone;

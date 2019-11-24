import React, { Component } from 'react';

class FaceSnapshot extends Component {

    constructor(props) {
        super(props);
        this.handleSnapshot = this.props.handleSnapshot;
    }

    async componentDidMount() {
        // get access to web camera
        window.navigator.mediaDevices.getUserMedia({ video: true })
            .then((mediaStream) => {
                // get image capture
                const mediaStreamTrack = mediaStream.getVideoTracks()[0];
                const imageCapture = new ImageCapture(mediaStreamTrack);

                // launch recurring camera snapshots
                window.setInterval(() => {
                    // on each snapshot
                    imageCapture.takePhoto()
                        .then((blob) => {
                            // convert Blob to ArrayBuffer
                            const fileReader = new FileReader();
                            fileReader.readAsArrayBuffer(blob);
                            fileReader.onload = (event) => {
                                // escalate to parent
                                const buffer = fileReader.result;
                                this.handleSnapshot(buffer);
                            };
                        })
                        .catch((error) => console.log(error));
                }, process.env.REACT_APP_SNAPSHOT_INTERVAL);
            })
            .catch((error) => console.log(error));
    }

    render() {
        return (
            <div className='snapshot-wrapper'>
            </div>
        );
    }
}

export default FaceSnapshot;
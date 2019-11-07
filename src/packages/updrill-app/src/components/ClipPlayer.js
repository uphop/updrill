import React, { Component } from 'react';
import ReactPlayer from 'react-player'

class ClipPlayer extends Component {
    render() {
        return (
            <div className="player-wrapper">
                <ReactPlayer
                    {...this.props.clip}
                    className='react-player'
                    width='100%'
                    height='100%'
                />
            </div>
        )
    }
}

export default ClipPlayer;

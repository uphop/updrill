'use strict';

// Close dialog with the customer, reporting fulfillmentState of Failed or Fulfilled ("Thanks, your pizza will arrive in 20 minutes")
function close(sessionAttributes, fulfillmentState, message) {
  return {
    sessionAttributes,
    dialogAction: {
      type: 'Close',
      fulfillmentState,
      message,
    },
  };
}

function getClip() {
  const baseUrl = 'https://do298rultu9mh.cloudfront.net';
  const clips = [
    'video-sleeping-cat.mp4',
    'video-washing-cat.mp4',
    'video-watching-cat.mp4'
  ];

  const clipIndex = Math.floor(Math.random() * clips.length);
  const clipUrl = baseUrl + '/' + clips[clipIndex];
  return clipUrl;
}

// --------------- Events -----------------------

function dispatch(intentRequest, callback) {
  console.log(`request received for userId=${intentRequest.userId}, intentName=${intentRequest.currentIntent.name}`);
  const sessionAttributes = intentRequest.sessionAttributes;
  const slots = intentRequest.currentIntent.slots;

  sessionAttributes.currentClip = getClip();

  callback(close(sessionAttributes, 'Fulfilled'));

}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
  try {
    dispatch(event,
      (response) => {
        callback(null, response);
      });
  } catch (err) {
    callback(err);
  }
};
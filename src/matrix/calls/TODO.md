## TODO
 - PeerCall
    - send invite
    - find out if we need to do something different when renegotation is triggered (a subsequent onnegotiationneeded event) whether
      we sent the invite/offer or answer. e.g. do we always do createOffer/setLocalDescription and then send it over a matrix negotiation event? even if we before called createAnswer.
    - handle receiving offer and send anwser
    - handle sending ice candidates
        - handle ice candidates finished (iceGatheringState === 'complete')
    - handle receiving ice candidates
    - handle sending renegotiation
    - handle receiving renegotiation
    - reject call
    - hangup call
    - handle muting tracks
    - handle remote track being muted
    - handle adding/removing tracks to an ongoing call
    - handle sdp metadata
 - Participant
    - handle glare
    - encrypt to_device message with olm
    - batch outgoing to_device messages in one request to homeserver for operations that will send out an event to all participants (e.g. mute)
    - find out if we should start muted or not?

## Store ongoing calls

Add store with all ongoing calls so when we quit and start again, we don't have to go through all the past calls to know which ones might still be ongoing.


## Notes

we send m.call as state event in room

we add m.call.participant for our own device

we wait for other participants to add their user and device (in the sources)

for each (userid, deviceid)
    - if userId < ourUserId
        - we setup a peer connection 
        - we wait for negotation event to get sdp
        - we send an m.call.invite 
    - else
        - wait for invite from other side


in some cases, we will actually send the invite to all devices (e.g. SFU), so
we probably still need to handle multiple anwsers?

so we would send an invite to multiple devices and pick the one for which we
received the anwser first. between invite and anwser, we could already receive
ice candidates that we need to buffer.

should a PeerCall only exist after we've received an answer?
Before that, we could have a PeerCallInvite



updating the metadata:

if we're renegotiating: use m.call.negotatie
if just muting: use m.call.sdp_stream_metadata_changed


party identification
 - for 1:1 calls, we identify with a party_id
 - for group calls, we identify with a device_id

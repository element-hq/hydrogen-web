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

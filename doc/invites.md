# Invites

 - invite_state doesn't update over /sync
 - can we reuse room summary? need to clear when joining
 - rely on filter operator to split membership=join from membership=invite?

 - invite_state comes once, and then not again
 - only state (no heroes for example, but we do get the members)
 - wants:
    - different class to represent invited room, with accept or reject method?
    - make it somewhat easy to render just joined rooms (rely on filter and still put them all in the same observable map)
    - make the transition from invite to joined smooth
    - reuse room summary logic?

    InvitedRoom
        isDM
        isEncrypted
        name

        timestamp
        accept()
        reject()
    JoiningRoom
        to store intent of room you joined through directory, invite, or just /join roomid
        also joining is retried when coming back online

        forget()
    Room

    so, also taking into account that other types of room we might not want to expose through session.rooms will have invites,
    perhaps it is best to expose invites through a different observable collection. You can always join/concat them to show in
    the same list.

    How do we handle a smooth UI transition when accepting an invite though?
    For looking at the room itself:
        - we would attach to the Invite event emitter, and we can have a property "joined" that we would update. Then you know you can go look for the room (or even allow to access the room through a property?)
        - so this way the view model can know when to switch and signal the view
    For the room list:
        - the new Room will be added at exactly the same moment the Invite is removed,
        so it should already be fairly smooth whether they are rendered in the same list or not.

    How will we locate the Invite/Room during sync when we go from invite => join?
     - have both adhere to sync target api (e.g. prepareSync, ...) and look in invite map
       if room id is not found in room map in session.getroom.
     - how do we remove the invite when join?
        - we ca
    Where to store?
        - room summaries?
        - do we have an interest in keeping the raw events?
        - room versions will add another layer of indirection to the room summaries (or will it? once you've upgraded the room, we don't care too much anymore about the details of the old room? hmmm, we do care about whether it is encrypted or not... we need everything to be able to show the timeline in any case)


        Invite => accept() => Room  (ends up in session.rooms)
         (.type)           => Space (ends up in session.spaces)
        Invite:
            - isEncrypted
            - isDM
            - type
            - id
            - name
            - avatarUrl
            - timestamp
            - joinRule (to say wheter you cannot join this room again if you reject)



        new "memberships":
            joining (when we want to join/are joining but haven't received remote echo yet)
            leaving (needed?)

            maybe it's slightly overkill to persist the intent of joining or leaving a room,
            but I do want a way to local echo joining a room,
            so that it immediately appears in the room list when clicking join in the room directory / from a url ... how would we sort these rooms though? we can always add another collection, but I'm not sure invites should be treated the same, they can already local echo on the invite object itself.


        since invites don't update, we could, in sync when processing a new join just set a flag on the roomsyncstate if a room is newly created and in writeSync/afterSync check if there is a `session.invites.get(id)` and call `writeSync/afterSync` on it as well. We need to handle leave => invite as well. So don't check for invites only if it is a new room, but also if membership is leave

        transitions are:
            invite => join
            invite => leave
            invite => ban
            join => left
            join => ban
            leave => invite
            leave => join
            leave => ban
            ban => leave
            none => invite
            none => join
            none => ban

        kick should keep the room & timeline visible (even in room list, until you archive?)
        leave should close the room. So explicit archive() step on room ?

        Room => leave() => ArchivedRoom (just a Room loaded from archived_room_summaries) => .forget()
                   => .forget()

        Room receives leave membership
            - if sender === state_key, we left, and we archive the room (remove it from the room list, but keep it in storage)
            - if sender !== state_key, we got kicked, and we write the membership but don't archive so it stays in the room list until you call archive/forget on the room
        when calling room.leave(), do you have to call archive() or forget() after as well? or rather param of leave and stored intent? sounds like non-atomical operation to me ...
        we should be able to archive or forget before leave remote echo arrives

        if two stores, this could mean we could have both an invite and a room with kicked state for a given room id?
        
        we should avoid key collisions between `session.invites` and `session.rooms` (also `session.archivedRooms` once supported?) in any case,
        because if we join them to display in one list, things get complicated.

        avoiding key collisions can happen both with 1 or multiple stores for different room states and is just a matter
        of carefully removing one state representation before adding another one.
            so a kicked or left room would disappear from session.rooms when an invite is synced?
            this would prevent you from seeing the old timeline for example, and if you reject, the old state would come back?


# Decisions
 - we expose session.invites separate from session.rooms because they are of a different type.
   This way, you only have methods on the object that make sense (accept on Room does not make sense, like Invite.openTimeline doesn't make sense)
 - we store invites (and likely also archived rooms) in a different store, so that we don't have to clear/add properties where they both differ when transitioning. Also, this gives us the possibility to show the timeline on a room that you have previously joined, as the room summary and invite can exist at the same time. (need to resolve key collision question though for this)
 - we want to keep kicked rooms in the room list until explicitly archived
 - room id collisions between invites and rooms, can we implement a strategy to prefer invites in the join operator?

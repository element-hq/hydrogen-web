# Replying to pending messages
The matrix spec requires clients capable of rich replies (that would be us once replies work) to include fallback (textual in `body` and structured in `formatted_body`) that can be rendered
by clients that do not natively support rich replies (that would be us at the time of writing). The schema for the fallback is as follows:

```
<mx-reply>
  <blockquote>
    <a href="https://matrix.to/#/!somewhere:example.org/$event:example.org">In reply to</a>
    <a href="https://matrix.to/#/@alice:example.org">@alice:example.org</a>
    <br />
    <!-- This is where the related event's HTML would be. -->
  </blockquote>
</mx-reply>
```

There's a single complication here for pending events: we have `$event:example.org` in the schema (the `In reply to` link), and it must
be present _within the content_, inside `formatted_body`. The issue is that, if we are queuing a reply to a pending event,
we don't know its remote ID. All we know is its transaction ID on our end. If we were to use that while formatting the message,
we'd be sending messages that contain our internal transaction IDs instead of proper matrix event identifiers.

To solve this, we'd need `SendQueue`, whenever it receives a remote echo, to update pending events that are replies with their
`relatedEventId`. This already happens, and the `event_id` field in `m.relates_to` is updated. But we'd need to extend this
to adjust the messages' `formatted_body` with the resolved remote ID, too.

How do we safely do this, without accidentally substituting event IDs into places in the body where they were not intended?

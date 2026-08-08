# FindFam Privacy Policy

_Draft — pending legal review before public launch. Written in plain language on
purpose; a lawyer should still check the wording before this is treated as final._

## What we collect

- **Location data**: your device's GPS coordinates, submitted while you have
  location sharing turned on. You can turn sharing off at any time from your
  profile — see the "Share my location" toggle.
- **Account data**: username, email, and password (stored as a salted hash,
  never in plain text).
- **Circle and contact data**: who you've added to your circles and emergency
  contacts, and messages sent inside circle chat.
- **SOS events**: if you trigger an SOS, we record the trigger time, your
  location at that moment, and who it was sent to.
- **Device metadata**: battery level and speed, shown to your circle members
  alongside your location (so they know if you're driving, or your phone is
  about to die) — not used for anything beyond that display.

## Who can see your data

- Your live location is visible only to members of circles you've explicitly
  joined, and to your emergency contacts.
- Chat messages are visible only to members of the circle they were sent in.
- FindFam admins can see account and moderation-relevant data (for handling
  abuse reports, suspensions, etc.) but do not have a routine feed of your
  location — access is for moderation purposes only.

## What we don't do

- **We do not sell your location data, or any other user data, to anyone.**
  This is a deliberate difference from apps that monetize location data via
  data brokers or ad networks. Confirmed in practice, not just in this
  document: the app and backend do not include any third-party analytics or
  advertising SDK.
- We do not share your location with anyone outside your circles/emergency
  contacts without your own action (there's no way for another user to add
  you to a circle or turn on sharing on your behalf — you have to be logged
  in and do it yourself).

## Data retention

Location history retention is **not yet finalized** — this is an open item,
tracked in `docs/02-database-schema.md`'s retention notes, that needs to be
decided before a wider launch. SOS events and chat messages are retained (not
auto-deleted), since they're the records most likely to matter for trust,
moderation, or a legal review if something goes wrong.

## Minors

FindFam is built with families in mind, which means some users may be minors.
An age-appropriate consent flow (e.g. parental consent for accounts under a
certain age) has not yet been built — this is a launch blocker if the app is
opened to real users where minors might sign up, not just a nice-to-have.

## Safety disclaimer

FindFam's SOS feature is a way to alert people you trust — it is **not a
substitute for calling emergency services** (911 or your local equivalent).
This is shown every time the SOS button is used, not just once in a settings
page.

## Contact

_(placeholder — add a real contact/support email before launch)_

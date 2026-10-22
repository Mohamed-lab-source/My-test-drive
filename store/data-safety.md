# Google Play "Data safety" answers

These match what the app really does. Answer the form like this.

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes (everything goes over HTTPS to Google Firebase).
**Do you provide a way for users to request that their data is deleted?** Yes — in the app (Profile → Delete my account) and on the web: `https://<your-project-id>.web.app/delete-account.html`

| Data type | Collected? | Shared? | Optional? | Why |
|---|---|---|---|---|
| Personal info → Name | Yes | No | Required (a display name) | App functionality, account management |
| Personal info → Email address | Yes (Google sign-in only) | No | Optional (guests have none) | Account management |
| Personal info → User IDs | Yes | No | Required | App functionality, account management |
| Location → Precise location | Yes | No | Optional (only when you tap "Send my location", check in, or share your live location with a group) | App functionality |
| Messages → Other in-app messages | Yes (group chats) | No | Optional | App functionality |
| Photos and videos | No | — | — | (QR scanning stays on the phone) |
| App activity → Other user-generated content | Yes (plans, notes, polls, check-ins, place reviews, "how busy" reports) | No | Optional | App functionality |
| App info and performance → Crash logs | Yes | No | Optional (can be turned off) | Analytics (fixing bugs) |

Notes for the form:
- "Near me", "How far?" and sorting by distance use your location **on the phone only**; it isn't saved.
- Recently viewed places, searches, star ratings, lists and settings stay **on the phone**: not "collected".
- Messages and locations you send to a group are seen by its members because you chose to send them: Google doesn't count that as "sharing".
- The AI request (vibe, time, a list of real places, and your optional note) goes to Google Gemini as a **service provider**: not "sharing".
- Place reviews (stars, answers, words) are shown publicly with your display name and guide level, because you chose to post them: not "sharing". You can delete them any time, and "Delete my account" removes them.
- "How busy is it now?" reports add only a count to the place's public numbers (no name). The time you last reported a place is kept privately under your account so nobody can spam; "Delete my account" removes it. It isn't your GPS location: you pick the place.
- Live location (groups): only when you choose to share, for at most 4 hours, only while the app is open, seen only by that group's members; deleted when you stop, leave the group or delete your account. Khroga never asks for background location.
- Track my outing: the recorded route stays **on the phone only**; not "collected".
- Outing reminders are scheduled **on the phone only** (Android notifications); nothing is sent to us.
- What you spent per person is an optional answer inside your public review.
- No ads, no analytics SDKs, no data sold.

# Security policy

## What matters here

getClosr is a static page that keeps every answer in the browser. Its promises are the security model, so the most important reports are about breaking them:

- anything that sends answers, notes or codes to a server or third party without the person choosing to share them
- a profile card, public QR profile or comparison card that reveals more than the share sheet says (for example activity notes or the overall note)
- a code that stays in the address bar or browser history after it was read
- an imported code that replaces or changes a local list without the two-step confirmation
- script injection through a name, note, hard limit or crafted code
- a crafted code that crashes the page or makes it unusable

Out of scope: problems that need access to the unlocked device, weaknesses in browsers or in Cloudflare itself, and denial of service against the hosting.

## Supported versions

Only the live site at [getclosr.link](https://getclosr.link) and the `main` branch get fixes. Please check that the problem still happens there.

## Reporting a vulnerability

Please do not open a public issue with details.

Open an issue titled "Security report, please contact me" with no details, and the maintainer will set up a private channel with you.

Include the steps to reproduce, the browser and device, and what you expected. Use an invented test profile. Never send a real person's code.

## What to expect

- Acknowledgement within 5 working days
- An assessment and a plan within 14 days
- A fix as soon as practical, and credit in the release notes unless you prefer to stay anonymous

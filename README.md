# BBBot – WhatsApp Group Game Manager

BBBot is a WhatsApp bot built using [open-wa/wa-automate](https://github.com/open-wa/wa-automate-nodejs). It helps organize basketball games in WhatsApp groups by letting admins manage games, onboard members, approve locations, and handle players and waitlists—all using simple chat commands.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:jainavana/bbot.git
cd bbbot

npm install

node main.js

bb game Lodha Tue 12pm 15 3
Create game at Lodha, Tuesday 12pm, max 15 players, min 3 members required

bb in
Join the game

bb out
Leave the game

bb list
Show current player list and waitlist

bb cancel
Cancel the active game (admin only)

bb location Lodha
Approve a location (admin only)

bb member Lodha @User
Mark a user as a member of Lodha (admin only)

bb admin @User
Promote a user to admin (admin only)

bb members Lodha
List all members of Lodha (admin only)

bb explain
Show available commands based on your role

// test-open-wa.js
import { create } from '@open-wa/wa-automate';

const sessions = new Map();
const roles = {
  superAdmins: new Set(['919819055003@c.us']),
  admins: new Map()
};

const approvedLocations = new Map(); // groupId -> Set of approved locations
const groupMembers = new Map(); // groupId -> Map<jid, Set<location>>

function isSuperAdmin(jid) {
  return roles.superAdmins.has(jid);
}

function isAdmin(jid, group) {
  return isSuperAdmin(jid) || (roles.admins.get(group) || new Set()).has(jid);
}

function addAdmin(group, jid) {
  if (!roles.admins.has(group)) roles.admins.set(group, new Set());
  roles.admins.get(group).add(jid);
}

function addLocation(group, location) {
  if (!approvedLocations.has(group)) approvedLocations.set(group, new Set());
  approvedLocations.get(group).add(location.toLowerCase());
}

function isApprovedLocation(group, location) {
  return (approvedLocations.get(group) || new Set()).has(location.toLowerCase());
}

function addMember(group, jid, location) {
  if (!groupMembers.has(group)) groupMembers.set(group, new Map());
  if (!groupMembers.get(group).has(jid)) groupMembers.get(group).set(jid, new Set());
  groupMembers.get(group).get(jid).add(location.toLowerCase());
}

function isMemberOfLocation(group, jid, location) {
  return (groupMembers.get(group)?.get(jid)?.has(location.toLowerCase())) || false;
}

function createGame(groupId, createdBy, title = '', name = '') {
  const [where, day, time, max, minMembers] = title.split(/\s+/);
  if (!where || !day || !time || isNaN(parseInt(max))) return null;
  if (!isApprovedLocation(groupId, where)) return '⚠️ This location is not approved yet.';

  sessions.set(groupId, {
    where,
    day,
    time,
    max: parseInt(max),
    minMembers: parseInt(minMembers) || 0,
    createdBy,
    players: new Map([[createdBy, name || createdBy]]),
    waitlist: [],
    createdAt: new Date().toLocaleString()
  });

  return sessions.get(groupId).createdAt;
}

function getList(groupId) {
  const game = sessions.get(groupId);
  if (!game) return '❌ No game currently active.';

  const players = [...game.players.entries()].map(
    ([_, name], i) => `${i + 1}. ${name}`
  ).join('\n');

  const waitlist = game.waitlist.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

  return `📍 *Where:* ${game.where}\n📅 *When:* ${game.day} ${game.time}\n👥 *Players (${game.players.size}/${game.max}):*\n${players}`
    + (waitlist.length ? `\n⏳ *Waitlist:*\n${waitlist}` : '');
}

function addPlayer(groupId, jid, name) {
  const game = sessions.get(groupId);
  if (!game) return '❌ No game active. Ask an admin to start one.';
  if (game.players.has(jid)) return '⚠️ You are already in.';
  if (game.waitlist.find(p => p.jid === jid)) return '⚠️ You are already on the waitlist.';

  const currentMembers = [...game.players.keys()].filter(j => isMemberOfLocation(groupId, j, game.where)).length;
  const userIsMember = isMemberOfLocation(groupId, jid, game.where);

  if (game.players.size >= game.max ||
      (game.max - game.players.size <= game.minMembers - currentMembers && !userIsMember)) {
    game.waitlist.push({ jid, name });
    return '⏳ Game full or minimum members not met. Youve been added to the waitlist.';
  }

  game.players.set(jid, name || jid);
  return '✅ Added!';
}

function removePlayer(groupId, jid) {
  const game = sessions.get(groupId);
  if (!game) return '❌ No game active.';

  const wasPlayer = game.players.delete(jid);
  const waitIndex = game.waitlist.findIndex(p => p.jid === jid);
  if (waitIndex !== -1) game.waitlist.splice(waitIndex, 1);

  if (wasPlayer && game.waitlist.length) {
    const next = game.waitlist.shift();
    game.players.set(next.jid, next.name);
    return `👋 Removed! ✅ Promoted ${next.name} from waitlist.`;
  }

  return '👋 Removed!';
}

function cancelGame(groupId) {
  sessions.delete(groupId);
}

function getCommands(userIsAdmin) {
  const base = [
    '*bb game <where> <day> <time> <max> <minMembers>* — Create game',
    '*bb list* — Show current game list',
    '*bb in* — Join the game',
    '*bb out* — Leave the game'
  ];
  const admin = [
    '*bb cancel* — Cancel the current game',
    '*bb admin* — Promote user by replying to message',
    '*bb location <location>* — Approve location',
    '*bb member <location>* — Onboard member by replying to their message'
  ];
  return base.concat(userIsAdmin ? admin : []).join('\n');
}

create({
  sessionId: 'bbbot',
  multiDevice: true,
  headless: false,
  qrTimeout: 60,
  authTimeout: 60,
  cacheEnabled: false
}).then(client => {
  console.log('✅ WhatsApp client ready.');

  client.onMessage(async message => {
    const { from, body, sender, isGroupMsg, chatId, quotedMsg } = message;
    if (!body.toLowerCase().startsWith('bb')) return;

    const [_, cmd, ...args] = body.trim().split(/\s+/);
    const reply = msg => client.sendText(chatId, msg);
    const senderId = sender.id;
    const groupId = isGroupMsg ? chatId : senderId;
    const senderName = sender.pushname || sender.verifiedName || senderId;

    switch (cmd) {
      case 'game': {
        if (!isAdmin(senderId, groupId)) return reply('❌ Only admins or super admins can create games.');
        const createdAt = createGame(groupId, senderId, args.join(' '), senderName);
        if (!createdAt) return reply('⚠️ Usage: *bb game <where> <day> <time> <max> <minMembers>*\nExample: *bb game lodha tue 12pm 15 3*');
        if (createdAt === '⚠️ This location is not approved yet.') return reply(createdAt);
        return reply(`✅ Game created for ${createdAt}. Players can now join using *bb in*.`);
      }
      case 'list':
        return reply(getList(groupId));
      case 'in':
        return reply(addPlayer(groupId, senderId, senderName));
      case 'out':
        return reply(removePlayer(groupId, senderId));
      case 'cancel': {
        if (!isAdmin(senderId, groupId)) return reply('❌ Only admins or super admins can cancel the game.');
        cancelGame(groupId);
        return reply('🚫 Game cancelled.');
      }
      case 'admin': {
        if (!isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        if (!quotedMsg) return reply('⚠️ Reply to a user\'s message to promote.');
        addAdmin(groupId, quotedMsg.sender.id);
        return reply(`👑 ${quotedMsg.sender.pushname || quotedMsg.sender.id} is now an admin.`);
      }
      case 'location': {
        if (!isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        const location = args[0];
        if (!location) return reply('⚠️ Usage: *bb location <name>*');
        addLocation(groupId, location);
        return reply(`📍 Location *${location}* approved.`);
      }
      case 'member': {
        if (!isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        const location = args[0];
        if (!quotedMsg || !location) return reply('⚠️ Usage: *bb member <location>* (reply to a user)');
        addMember(groupId, quotedMsg.sender.id, location);
        return reply(`✅ ${quotedMsg.sender.pushname || quotedMsg.sender.id} marked as member of ${location}.`);
      }
      case 'explain': {
        const userIsAdmin = isAdmin(senderId, groupId);
        return reply(`📖 Available commands:\n${getCommands(userIsAdmin)}`);
      }
      default:
        return;
    }
  });
});
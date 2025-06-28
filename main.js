// main.js
import { create } from '@open-wa/wa-automate';
import storage from './storage.js';
import dotenv from 'dotenv';

dotenv.config();

function normalizeJid(jid) {
  return jid.split(':')[0];
}

async function isSuperAdmin(jid) {
  const { roles } = await storage.getData();
  return roles.superAdmins.includes(normalizeJid(jid));
}

async function isAdmin(jid, group) {
  const { roles } = await storage.getData();
  return (await isSuperAdmin(jid)) || (roles.admins[group] || []).includes(normalizeJid(jid));
}

async function addAdmin(group, jid) {
  await storage.update(data => {
    data.roles.admins[group] ||= [];
    if (!data.roles.admins[group].includes(jid)) {
      data.roles.admins[group].push(jid);
    }
  });
}

async function addLocation(group, location) {
  await storage.update(data => {
    data.approvedLocations[group] ||= [];
    const loc = location.toLowerCase();
    if (!data.approvedLocations[group].includes(loc)) {
      data.approvedLocations[group].push(loc);
    }
  });
}

async function isApprovedLocation(group, location) {
  const { approvedLocations } = await storage.getData();
  return (approvedLocations[group] || []).includes(location.toLowerCase());
}

async function addMember(group, jid, location) {
  await storage.update(data => {
    data.groupMembers[group] ||= {};
    data.groupMembers[group][jid] ||= [];
    const loc = location.toLowerCase();
    if (!data.groupMembers[group][jid].includes(loc)) {
      data.groupMembers[group][jid].push(loc);
    }
  });
}

async function isMemberOfLocation(group, jid, location) {
  const { groupMembers } = await storage.getData();
  return (groupMembers[group]?.[jid]?.includes(location.toLowerCase())) || false;
}

async function createGame(groupId, createdBy, title = '', name = '') {
  const [where, day, time, max, minMembers] = title.split(/\s+/);
  if (!where || !day || !time || isNaN(parseInt(max))) return null;
  if (!await isApprovedLocation(groupId, where)) return '⚠️ This location is not approved yet.';

  await storage.update(data => {
    data.sessions[groupId] = {
      where,
      day,
      time,
      max: parseInt(max),
      minMembers: parseInt(minMembers) || 0,
      createdBy,
      players: { [createdBy]: name || createdBy },
      waitlist: [],
      createdAt: `${day.toUpperCase()} @ ${time}`
    };
  });
  return `${day.toUpperCase()} @ ${time}`;
}

async function getList(groupId) {
  const { sessions } = await storage.getData();
  const game = sessions[groupId];
  if (!game) return '❌ No game currently active.';

  const players = Object.entries(game.players).map(
    ([_, name], i) => `${i + 1}. ${name}`
  ).join('\n');

  const waitlist = game.waitlist.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

  return `📍 *Where:* ${game.where}\n📅 *When:* ${game.day} ${game.time}\n👥 *Players (${Object.keys(game.players).length}/${game.max}):*\n${players}`
    + (waitlist.length ? `\n⏳ *Waitlist:*\n${waitlist}` : '');
}

async function addPlayer(groupId, jid, name) {
  const { sessions, groupMembers } = await storage.getData();
  const game = sessions[groupId];
  if (!game) return '❌ No game active. Ask an admin to start one.';
  if (game.players[jid]) return '⚠️ You are already in.';
  if (game.waitlist.find(p => p.jid === jid)) return '⚠️ You are already on the waitlist.';

  const currentMembers = Object.keys(game.players).filter(j =>
    groupMembers[groupId]?.[j]?.includes(game.where.toLowerCase())
  ).length;
  const userIsMember = groupMembers[groupId]?.[jid]?.includes(game.where.toLowerCase());

  if (Object.keys(game.players).length >= game.max ||
      (game.max - Object.keys(game.players).length <= game.minMembers - currentMembers && !userIsMember)) {
    await storage.update(data => {
      data.sessions[groupId].waitlist.push({ jid, name });
    });
    return '⏳ Game full or minimum members not met. Youve been added to the waitlist.';
  }

  await storage.update(data => {
    data.sessions[groupId].players[jid] = name || jid;
  });
  return '✅ Added!';
}

async function removePlayer(groupId, jid) {
  const { sessions } = await storage.getData();
  const game = sessions[groupId];
  if (!game) return '❌ No game active.';

  const wasPlayer = delete game.players[jid];
  const waitIndex = game.waitlist.findIndex(p => p.jid === jid);
  if (waitIndex !== -1) game.waitlist.splice(waitIndex, 1);

  let promotedMsg = '';
  if (wasPlayer && game.waitlist.length) {
    const next = game.waitlist.shift();
    game.players[next.jid] = next.name;
    promotedMsg = ` ✅ Promoted ${next.name} from waitlist.`;
  }

  await storage.save();
  return `👋 Removed!${promotedMsg}`;
}

async function cancelGame(groupId) {
  await storage.update(data => {
    delete data.sessions[groupId];
  });
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
    '*bb admin @user* — Promote user',
    '*bb location <location>* — Approve location',
    '*bb member <location> @user* — Onboard member'
  ];
  return base.concat(userIsAdmin ? admin : []).join('\n');
}

create({
  sessionId: 'bbbot',
  useChrome: true,
  headless: false,
  deleteSessionDataOnLogout: true,
  qrTimeout: 0,
  authStrategy: 'legacy',
  multiDevice: true,
  linkCode: true,
  disableSpins: true,
  logConsole: true,
  popup: false
}).then(client => {
  console.log('✅ WhatsApp client ready.');

  client.onMessage(async message => {
    const { body, sender, isGroupMsg, chatId, mentionedJidList } = message;
    if (!body.toLowerCase().startsWith('bb')) return;

    console.log(`📩 Received command: ${body} from ${sender.id} in ${chatId}`);

    const [_, cmd, ...args] = body.trim().split(/\s+/);
    const reply = msg => client.sendText(chatId, msg);
    const senderId = sender.id;
    const groupId = isGroupMsg ? chatId : senderId;
    const senderName = sender.pushname || sender.verifiedName || senderId;

    switch (cmd) {
      case 'game': {
        if (!await isAdmin(senderId, groupId)) return reply('❌ Only admins or super admins can create games.');
        const createdAt = await createGame(groupId, senderId, args.join(' '), senderName);
        if (!createdAt) return reply('⚠️ Usage: *bb game <where> <day> <time> <max> <minMembers>*');
        if (createdAt === '⚠️ This location is not approved yet.') return reply(createdAt);
        return reply(`✅ Game created for ${createdAt}. Players can now join using *bb in*.`);
      }
      case 'list': return reply(await getList(groupId));
      case 'in': return reply(await addPlayer(groupId, senderId, senderName));
      case 'out': return reply(await removePlayer(groupId, senderId));
      case 'cancel': {
        if (!await isAdmin(senderId, groupId)) return reply('❌ Only admins or super admins can cancel the game.');
        await cancelGame(groupId);
        return reply('🚫 Game cancelled.');
      }
      case 'admin': {
        if (!await isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        const target = mentionedJidList?.[0];
        if (!target) return reply('⚠️ Usage: *bb admin @user*');
        await addAdmin(groupId, target);
        return reply(`👑 ${target} is now an admin.`);
      }
      case 'location': {
        if (!await isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        const location = args[0];
        if (!location) return reply('⚠️ Usage: *bb location <name>*');
        await addLocation(groupId, location);
        return reply(`📍 Location *${location}* approved.`);
      }
      case 'member': {
        if (!await isAdmin(senderId, groupId)) return reply('❌ Permission denied.');
        const location = args[0];
        const mentionedJids = mentionedJidList || [];
        if (!mentionedJids.length || !location) return reply('⚠️ Usage: *bb member <location> @user*');
        await addMember(groupId, mentionedJids[0], location);
        return reply(`✅ Added as member of ${location}`);
      }
      case 'members': {
        const location = args[0];
        if (!location) return reply('⚠️ Usage: *bb members <location>*');
        const { groupMembers } = await storage.getData();
        const membersMap = groupMembers[groupId];
        if (!membersMap) return reply(`❌ No members found for *${location}*.`);
        const members = Object.entries(membersMap)
          .filter(([_, locs]) => locs.includes(location.toLowerCase()))
          .map(([jid], i) => `${i + 1}. ${jid.split('@')[0]}`);
        if (members.length === 0) return reply(`❌ No members found for *${location}*.`);
        return reply(`👥 Members of *${location}*:\n${members.join('\n')}`);
      }
      case 'explain': {
        const userIsAdmin = await isAdmin(senderId, groupId);
        return reply(`📖 Available commands:\n${getCommands(userIsAdmin)}`);
      }
      default: return;
    }
  });
});

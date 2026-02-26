const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharacter } = require('../../utils/persistence');
const { getParty, saveParty, deleteParty } = require('../../utils/persistence');

// Store pending invites temporarily (guildId-odiscordUserId -> { odiscordUserId, odiscordUserName, expires })
const pendingInvites = new Map();

/**
 * Handle ~crawl party commands
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleParty(msg, args) {
    const action = args[0]?.toLowerCase();
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    switch (action) {
        case 'create':
            return createParty(msg, guildId, userId);

        case 'invite':
            return inviteToParty(msg, guildId, userId, args.slice(1));

        case 'join':
        case 'accept':
            return joinParty(msg, guildId, userId);

        case 'leave':
            return leaveParty(msg, guildId, userId);

        case 'kick':
            return kickFromParty(msg, guildId, userId, args.slice(1));

        case 'disband':
            return disbandParty(msg, guildId, userId);

        case 'reset':
            return resetParty(msg, guildId, userId);

        case 'info':
        case 'status':
        case undefined:
            return showPartyInfo(msg, guildId, userId);

        default:
            return msg.reply(`Unknown party command: \`${action}\`. Try \`create\`, \`invite\`, \`join\`, \`leave\`, \`kick\`, \`disband\`, or \`info\`.`);
    }
}

async function createParty(msg, guildId, userId) {
    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You need a character to create a party! Use `~crawl create` first.');
    }

    const existingParty = await getParty(guildId, userId);
    if (existingParty) {
        return msg.reply('You\'re already in a party! Use `~crawl party leave` first.');
    }

    const party = {
        guildId,
        leaderId: userId,
        leaderName: character.name,
        members: [userId],
        memberNames: { [userId]: character.name },
        maxSize: 4,
        status: 'forming',
        createdAt: Date.now()
    };

    await saveParty(guildId, party);

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('Party Created!')
        .setDescription(`**${character.name}** has formed a new party!`)
        .addFields(
            { name: 'Leader', value: character.name, inline: true },
            { name: 'Members', value: '1/4', inline: true },
            { name: 'Status', value: 'Forming', inline: true }
        )
        .setFooter({ text: 'Use ~crawl party invite @user to invite others' });

    return msg.reply({ embeds: [embed] });
}

async function inviteToParty(msg, guildId, userId, args) {
    const party = await getParty(guildId, userId);
    if (!party) {
        return msg.reply('You\'re not in a party! Use `~crawl party create` first.');
    }

    if (party.leaderId !== userId) {
        return msg.reply('Only the party leader can invite members!');
    }

    if (party.members.length >= party.maxSize) {
        return msg.reply('Your party is full! (4/4 members)');
    }

    const mentioned = msg.mentions.users.first();
    if (!mentioned) {
        return msg.reply('Please mention a user to invite! Example: `~crawl party invite @username`');
    }

    if (mentioned.bot) {
        return msg.reply('You can\'t invite bots to your party!');
    }

    if (party.members.includes(mentioned.id)) {
        return msg.reply('That user is already in your party!');
    }

    const inviteeCharacter = await getCharacter(guildId, mentioned.id);
    if (!inviteeCharacter) {
        return msg.reply(`${mentioned.username} doesn't have a character yet! They need to use \`~crawl create\` first.`);
    }

    const inviteeParty = await getParty(guildId, mentioned.id);
    if (inviteeParty) {
        return msg.reply(`${mentioned.username} is already in a party!`);
    }

    // Store invite (expires in 5 minutes)
    const inviteKey = `${guildId}-${mentioned.id}`;
    pendingInvites.set(inviteKey, {
        odiscordUserId: userId,
        odiscordUserName: msg.author.username,
        partyLeaderId: party.leaderId,
        expires: Date.now() + 5 * 60 * 1000
    });

    // Safely get member names (memberNames might be undefined from DB)
    const memberNames = party.memberNames || {};
    const memberList = party.members.map(m => memberNames[m] || 'Unknown').join('\n') || 'None';

    const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('Party Invite!')
        .setDescription(`${mentioned}, you've been invited to join **${party.leaderName}**'s party!`)
        .addFields(
            { name: 'Current Members', value: memberList, inline: true },
            { name: 'Party Size', value: `${party.members.length}/${party.maxSize}`, inline: true }
        )
        .setFooter({ text: 'Use ~crawl party join to accept (expires in 5 minutes)' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_partyjoin_${mentioned.id}_${party.leaderId}`)
            .setLabel('Join Party')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`crawl_partydecline_${mentioned.id}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    return msg.reply({ content: `<@${mentioned.id}>`, embeds: [embed], components: [row] });
}

async function joinParty(msg, guildId, userId) {
    const inviteKey = `${guildId}-${userId}`;
    const invite = pendingInvites.get(inviteKey);

    if (!invite || Date.now() > invite.expires) {
        pendingInvites.delete(inviteKey);
        return msg.reply('You don\'t have any pending party invites!');
    }

    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You need a character to join a party! Use `~crawl create` first.');
    }

    const party = await getParty(guildId, invite.partyLeaderId);
    if (!party) {
        pendingInvites.delete(inviteKey);
        return msg.reply('The party no longer exists!');
    }

    if (party.members.length >= party.maxSize) {
        pendingInvites.delete(inviteKey);
        return msg.reply('The party is now full!');
    }

    // Add to party (ensure memberNames exists)
    if (!party.memberNames) party.memberNames = {};
    party.members.push(userId);
    party.memberNames[userId] = character.name;
    await saveParty(guildId, party);
    pendingInvites.delete(inviteKey);

    const memberList = party.members.map(m => party.memberNames[m] || 'Unknown').join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Joined Party!')
        .setDescription(`**${character.name}** has joined the party!`)
        .addFields(
            { name: 'Leader', value: party.leaderName || 'Unknown', inline: true },
            { name: 'Members', value: `${party.members.length}/${party.maxSize}`, inline: true }
        )
        .addFields({
            name: 'Party Members',
            value: memberList,
            inline: false
        })
        .setFooter({ text: 'The party leader can start a dungeon with ~crawl start' });

    return msg.reply({ embeds: [embed] });
}

async function leaveParty(msg, guildId, userId) {
    const party = await getParty(guildId, userId);
    if (!party) {
        return msg.reply('You\'re not in a party!');
    }

    const character = await getCharacter(guildId, userId);
    const characterName = character?.name || 'Unknown';

    // Ensure memberNames exists
    if (!party.memberNames) party.memberNames = {};

    if (party.leaderId === userId) {
        // Leader leaving disbands or transfers leadership
        if (party.members.length === 1) {
            await deleteParty(guildId, userId);
            return msg.reply(`**${characterName}** has disbanded the party.`);
        } else {
            // Transfer leadership to next member
            // Delete old party first (keyed by old leader), then save new one
            await deleteParty(guildId, userId);
            party.members = party.members.filter(m => m !== userId);
            delete party.memberNames[userId];
            party.leaderId = party.members[0];
            party.leaderName = party.memberNames[party.leaderId] || 'Unknown';
            party.status = 'forming';
            await saveParty(guildId, party);

            return msg.reply(`**${characterName}** has left the party. **${party.leaderName}** is now the party leader.`);
        }
    } else {
        // Regular member leaving
        party.members = party.members.filter(m => m !== userId);
        delete party.memberNames[userId];
        await saveParty(guildId, party);

        return msg.reply(`**${characterName}** has left the party.`);
    }
}

async function kickFromParty(msg, guildId, userId, args) {
    const party = await getParty(guildId, userId);
    if (!party) {
        return msg.reply('You\'re not in a party!');
    }

    if (party.leaderId !== userId) {
        return msg.reply('Only the party leader can kick members!');
    }

    const mentioned = msg.mentions.users.first();
    if (!mentioned) {
        return msg.reply('Please mention a user to kick! Example: `~crawl party kick @username`');
    }

    if (mentioned.id === userId) {
        return msg.reply('You can\'t kick yourself! Use `~crawl party leave` instead.');
    }

    if (!party.members.includes(mentioned.id)) {
        return msg.reply('That user is not in your party!');
    }

    // Ensure memberNames exists
    if (!party.memberNames) party.memberNames = {};
    const kickedName = party.memberNames[mentioned.id] || mentioned.username;
    party.members = party.members.filter(m => m !== mentioned.id);
    delete party.memberNames[mentioned.id];
    await saveParty(guildId, party);

    return msg.reply(`**${kickedName}** has been kicked from the party.`);
}

async function disbandParty(msg, guildId, userId) {
    const party = await getParty(guildId, userId);
    if (!party) {
        return msg.reply('You\'re not in a party!');
    }

    if (party.leaderId !== userId) {
        return msg.reply('Only the party leader can disband the party!');
    }

    await deleteParty(guildId, userId);

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Party Disbanded')
        .setDescription(`**${party.leaderName}** has disbanded the party.`)
        .setFooter({ text: 'All members have been removed' });

    return msg.reply({ embeds: [embed] });
}

async function resetParty(msg, guildId, userId) {
    // Force cleanup any party association - useful for fixing stale state
    const party = await getParty(guildId, userId);
    if (!party) {
        return msg.reply('You\'re not associated with any party.');
    }

    // If they're the leader, disband the party entirely
    if (party.leaderId === userId) {
        await deleteParty(guildId, userId);
        return msg.reply('Party association reset. Your party has been disbanded.');
    }

    // If they're a member, remove them from the party
    party.members = party.members.filter(m => m !== userId);
    if (party.memberNames) delete party.memberNames[userId];
    await saveParty(guildId, party);

    return msg.reply('Party association reset. You have been removed from the party.');
}

async function showPartyInfo(msg, guildId, userId) {
    const party = await getParty(guildId, userId);
    if (!party) {
        const embed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle('No Party')
            .setDescription('You\'re not currently in a party.')
            .addFields(
                { name: 'Create a Party', value: '`~crawl party create`', inline: true },
                { name: 'Join a Party', value: 'Wait for an invite!', inline: true }
            );
        return msg.reply({ embeds: [embed] });
    }

    const isLeader = party.leaderId === userId;
    const memberNames = party.memberNames || {};
    const leaderName = party.leaderName || 'Unknown';

    const memberList = party.members.map(m => {
        const name = memberNames[m] || 'Unknown';
        return m === party.leaderId ? `👑 ${name}` : `  ${name}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`${leaderName}'s Party`)
        .setDescription(isLeader ? '*You are the party leader*' : `*Leader: ${leaderName}*`)
        .addFields(
            { name: 'Members', value: `${party.members.length}/${party.maxSize}`, inline: true },
            { name: 'Status', value: party.status === 'forming' ? 'Forming' : 'In Dungeon', inline: true }
        )
        .addFields({
            name: 'Party Members',
            value: memberList,
            inline: false
        });

    if (isLeader) {
        embed.setFooter({ text: 'Use ~crawl party invite @user | ~crawl start to begin' });
    } else {
        embed.setFooter({ text: 'Waiting for party leader to start dungeon' });
    }

    return msg.reply({ embeds: [embed] });
}

/**
 * Handle party button interactions
 */
async function handlePartyJoinButton(interaction, odiscordUserId, leaderId) {
    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This invite is not for you!', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const inviteKey = `${guildId}-${odiscordUserId}`;

    const character = await getCharacter(guildId, odiscordUserId);
    if (!character) {
        return interaction.reply({ content: 'You need a character first! Use `~crawl create`.', ephemeral: true });
    }

    const party = await getParty(guildId, leaderId);
    if (!party) {
        pendingInvites.delete(inviteKey);
        return interaction.update({ content: 'The party no longer exists!', embeds: [], components: [] });
    }

    if (party.members.length >= party.maxSize) {
        pendingInvites.delete(inviteKey);
        return interaction.update({ content: 'The party is now full!', embeds: [], components: [] });
    }

    // Check if already in a party
    const existingParty = await getParty(guildId, odiscordUserId);
    if (existingParty) {
        return interaction.reply({ content: 'You\'re already in a party! Leave first with `~crawl party leave`.', ephemeral: true });
    }

    // Add to party (ensure memberNames exists)
    if (!party.memberNames) party.memberNames = {};
    party.members.push(odiscordUserId);
    party.memberNames[odiscordUserId] = character.name;
    await saveParty(guildId, party);
    pendingInvites.delete(inviteKey);

    const memberList = party.members.map(m => party.memberNames[m] || 'Unknown').join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Joined Party!')
        .setDescription(`**${character.name}** has joined the party!`)
        .addFields(
            { name: 'Leader', value: party.leaderName || 'Unknown', inline: true },
            { name: 'Members', value: `${party.members.length}/${party.maxSize}`, inline: true }
        )
        .addFields({
            name: 'Party Members',
            value: memberList,
            inline: false
        })
        .setFooter({ text: 'The party leader can start a dungeon with ~crawl start' });

    return interaction.update({ embeds: [embed], components: [] });
}

async function handlePartyDeclineButton(interaction, odiscordUserId) {
    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This invite is not for you!', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const inviteKey = `${guildId}-${odiscordUserId}`;
    pendingInvites.delete(inviteKey);

    return interaction.update({ content: 'Invite declined.', embeds: [], components: [] });
}

module.exports = {
    handleParty,
    handlePartyJoinButton,
    handlePartyDeclineButton,
    pendingInvites
};

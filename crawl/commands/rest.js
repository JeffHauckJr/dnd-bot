const { EmbedBuilder } = require('discord.js');
const { getCharacter, saveCharacter } = require('../../utils/persistence');
const { getSession } = require('../../utils/crawlState');

const REST_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Handle ~crawl rest command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleRest(msg, args) {
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You don\'t have a character! Use `~crawl create` to make one.');
    }

    // Check if in a dungeon
    const session = getSession(guildId, userId);
    if (session) {
        return msg.reply('You cannot rest while in a dungeon! Finish or retreat first.');
    }

    // Check if already at full HP
    if (character.currentHp >= character.maxHp) {
        return msg.reply(`**${character.name}** is already at full health! (${character.currentHp}/${character.maxHp} HP)`);
    }

    // Check if already on rest cooldown
    if (character.restCooldownUntil) {
        const now = Date.now();
        if (now < character.restCooldownUntil) {
            const remainingMs = character.restCooldownUntil - now;
            const remainingMins = Math.ceil(remainingMs / 60000);
            const remainingSecs = Math.ceil((remainingMs % 60000) / 1000);

            if (remainingMins > 1) {
                return msg.reply(`**${character.name}** is still recovering from their last rest. Ready in **${remainingMins} minutes**.`);
            } else {
                return msg.reply(`**${character.name}** is still recovering from their last rest. Ready in **${remainingSecs} seconds**.`);
            }
        }
    }

    // Heal to full HP
    const healedAmount = character.maxHp - character.currentHp;
    character.currentHp = character.maxHp;

    // Set cooldown for starting next dungeon
    character.restCooldownUntil = Date.now() + REST_COOLDOWN_MS;

    await saveCharacter(guildId, userId, character);

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Rest Complete')
        .setDescription(`**${character.name}** takes a well-deserved rest...`)
        .addFields(
            { name: 'HP Restored', value: `+${healedAmount} HP`, inline: true },
            { name: 'Current HP', value: `${character.currentHp}/${character.maxHp}`, inline: true },
            { name: 'Dungeon Cooldown', value: '10 minutes', inline: true }
        )
        .setFooter({ text: 'You must wait 10 minutes before starting a new dungeon.' });

    return msg.reply({ embeds: [embed] });
}

/**
 * Check if a character is on rest cooldown
 * @param {object} character
 * @returns {{ onCooldown: boolean, remainingMs: number, remainingText: string }}
 */
function checkRestCooldown(character) {
    if (!character.restCooldownUntil) {
        return { onCooldown: false, remainingMs: 0, remainingText: '' };
    }

    const now = Date.now();
    if (now >= character.restCooldownUntil) {
        return { onCooldown: false, remainingMs: 0, remainingText: '' };
    }

    const remainingMs = character.restCooldownUntil - now;
    const remainingMins = Math.ceil(remainingMs / 60000);
    const remainingSecs = Math.ceil((remainingMs % 60000) / 1000);

    let remainingText;
    if (remainingMins > 1) {
        remainingText = `${remainingMins} minutes`;
    } else {
        remainingText = `${remainingSecs} seconds`;
    }

    return { onCooldown: true, remainingMs, remainingText };
}

module.exports = {
    handleRest,
    checkRestCooldown,
    REST_COOLDOWN_MS
};

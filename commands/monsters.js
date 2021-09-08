const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const monster = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = monster.split(" ");
  
        const join2Words = indWords[0] + "-" + indWords[1];
  
        const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];
  
        const join4Words =
          indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];
  
        const newInput = () => {
          if (indWords.length === 2) {
            return join2Words;
          } else if (indWords.length === 3) {
            return join3Words;
          } else if (indWords.length === 4) {
            return join4Words;
          } else {
            return monster;
          }
        };
  
        const monURL = `https://www.dnd5eapi.co/api/monsters/${newInput()}`;
        const response = await axios.get(monURL);
        const data = response.data;
        console.log(data);
  
        if (data.special_abilities) {
          const specialAbilities = data.special_abilities
            .map((abl) => {
              return `
            **Name**: ${abl.name || "None"}
            **Description**: ${abl.desc || "None"} 
            `;
            })
            .join(" ");
  
          const actions = data.actions
            .map((act) => {
              return `
            **Name**: ${act.name}
            **Description**: ${act.desc}
            `;
            })
            .join(" ");
  
          const monsterEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .addFields(
              {
                name: "Size",
                value: `${data.size}`,
                inline: true,
              },
              { name: "Type", value: `${data.type}`, inline: true },
              { name: "Alignment", value: `${data.alignment}`, inline: false },
              { name: "AC", value: `${data.armor_class}`, inline: true },
              { name: "Hit Points", value: `${data.hit_points}`, inline: true },
              { name: "Hit Die", value: `${data.hit_dice}` },
              {
                name: "Ability Scores",
                value: `
            Str: ${data.strength}
            Con: ${data.constitution}
            Int: ${data.intelligence}
            Wis: ${data.wisdom}
            Dex: ${data.dexterity}
            Cha: ${data.charisma}
            `,
              },
              { name: `Languages`, value: `${data.languages || "None"}` },
              {
                name: `Challenge Rating`,
                value: `${data.challenge_rating || "None"}`,
                inline: true,
              },
              { name: `XP`, value: `${data.xp || "None"}`, inline: true }
            );
  
          const actionEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`).setDescription(`**Special Abilities**
               ${specialAbilities} 
              **Actions** 
              ${actions}`);
  
          msg
            .reply({ embeds: [monsterEmbed] })
            .then(msg.reply({ embeds: [actionEmbed] }));
        } else if (!data.special_abilities) {
          const monsterEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .addFields(
              {
                name: "Size",
                value: `${data.size}`,
                inline: true,
              },
              { name: "Type", value: `${data.type}`, inline: true },
              { name: "Alignment", value: `${data.alignment}`, inline: false },
              { name: "AC", value: `${data.armor_class}`, inline: true },
              { name: "Hit Points", value: `${data.hit_points}`, inline: true },
              { name: "Hit Die", value: `${data.hit_dice}` },
              {
                name: "Ability Scores",
                value: `
            Str: ${data.strength}
            Con: ${data.constitution}
            Int: ${data.intelligence}
            Wis: ${data.wisdom}
            Dex: ${data.dexterity}
            Cha: ${data.charisma}
            `,
              },
              { name: `Languages`, value: `${data.languages || "None"}` },
              {
                name: `Challenge Rating`,
                value: `${data.challenge_rating || "None"}`,
                inline: true,
              },
              { name: `XP`, value: `${data.xp || "None"}`, inline: true }
            );
  
          msg.reply({ embeds: [monsterEmbed] });
        }
      } catch (err) {
        console.log(err);
        msg.reply(`There are no mosters by that name`);
      }
}
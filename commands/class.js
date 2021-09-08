const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const classes = msg.content
          .split(" ")
          .slice(2)
          .join(" ")
          .toLocaleLowerCase();
        const classUrl = `https://www.dnd5eapi.co/api/classes/${classes}`;
        const response = await axios.get(classUrl);
        const data = response.data;
  
        if (!data.spellcasting) {
          const proList = data.proficiencies
            .map((pro) => {
              const pros = pro.name;
              return `${pros}
          `;
            })
            .join(" ");
  
          const proSkillList = data.proficiency_choices[0].from
            .map((skill) => {
              return `${skill.name}  
          `;
            })
            .join(" ");
          const classEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`Class : ${data.name}`)
            .setURL()
            .addFields(
              { name: "Hit Die", value: `${data.hit_die}` },
              {
                name: `Starting proficiencies where the player ${data.proficiency_choices[0].choose} from the given list of proficiencies.`,
                value: `${proSkillList}` || "Something",
              },
              {
                name: "Starting proficiencies all new characters of this class start with.",
                value: `${proList}` || "Something",
              }
            );
          msg.reply({ embeds: [classEmbed] });
        } else {
          const proList = data.proficiencies
            .map((pro) => {
              const pros = pro.name;
              return `${pros}
          `;
            })
            .join(" ");
  
          const proSkillList = data.proficiency_choices[0].from
            .map((skill) => {
              return `${skill.name}  
          `;
            })
            .join(" ");
          const classEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`Class : ${data.name}`)
            .setURL()
            .addFields(
              { name: "Hit Die", value: `${data.hit_die}` },
              {
                name: `Starting proficiencies where the player ${data.proficiency_choices[0].choose} from the given list of proficiencies.`,
                value: `${proSkillList}` || "Something",
              },
              {
                name: "Starting proficiencies all new characters of this class start with.",
                value: `${proList}` || "Something",
              }
            );
  
          const spellcastingEmbed = new MessageEmbed()
            .setColor(`RED`)
            .setTitle(` ${data.name} SpellCasting`)
            .setDescription(
              `
            **Level**: ${data.spellcasting.level}
            **Ability Mod**: ${data.spellcasting.spellcasting_ability.name}
  
            ${data.spellcasting.info
              .map((spell) => {
                return `**Name**:
              ${spell.name}
  
              **Description**:
              ${spell.desc}
        
              `;
              })
              .join(" ")}
  
            `
            );
          console.log(data.spellcasting.info);
          msg
            .reply({ embeds: [classEmbed] })
            .then(msg.reply({ embeds: [spellcastingEmbed] }));
        }
      } catch (err) {
        console.log(err);
        msg.reply("Try a Basic Class");
      }
}
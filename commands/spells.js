const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const spell = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = spell.split(" ");
  
        const join2Words = indWords[0] + "-" + indWords[1];
  
        const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];
  
        const join4Words =
          indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];
  
        const spellInput = () => {
          if (indWords.length === 2) {
            return join2Words;
          } else if (indWords.length === 3) {
            return join3Words;
          } else if (indWords.length === 4) {
            return join4Words;
          } else {
            return spell;
          }
        };
        const spellUrl = `https://www.dnd5eapi.co/api/spells/${spellInput()}`;
        const response = await axios.get(spellUrl);
        const data = response.data;
        const dmg = data?.damage?.damage_at_slot_level;
  
        if (!dmg) {
          const supportSpellEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .setURL()
            .addFields(
              {
                name: "Description",
                value: `${data?.name === "Wish" ? data?.desc[1] : data.desc}`,
              },
              { name: "Range", value: `${data.range || "None"}` },
              { name: "Components", value: `${data.components || "None"}` },
              { name: "Materials", value: `${data.material || "None"}` },
              { name: "Duration", value: `${data.duration || "None"}` },
              { name: "Level", value: `${data.level || "None"}` }
            );
  
          msg.reply({ embeds: [supportSpellEmbed] });
        } else {
          const damageSpellEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .setURL()
            .addFields(
              { name: "Description", value: `${data.desc}` },
              { name: "Range", value: `${data.range || "None"}` },
              { name: "Components", value: `${data.components || "None"}` },
              { name: "Materials", value: `${data.material || "None"}` },
              { name: "Duration", value: `${data.duration || "None"}` },
              { name: "Level", value: `${data.level || "None"}` },
              {
                name: "Damage Per Level Slot",
                value: `1: ${data?.damage.damage_at_slot_level[1] || "None"}
                2: ${data?.damage.damage_at_slot_level[2] || "None"}
                3: ${data?.damage.damage_at_slot_level[3] || "None"}
                4: ${data.damage?.damage_at_slot_level[4] || "None"}
                5: ${data.damage?.damage_at_slot_level[5] || "None"}
                6: ${data.damage?.damage_at_slot_level[6] || "None"}
                7: ${data.damage?.damage_at_slot_level[7] || "None"}
                8: ${data.damage?.damage_at_slot_level[8] || "None"}
                9: ${data.damage?.damage_at_slot_level[9] || "None"}`,
              }
            );
          msg.reply({ embeds: [damageSpellEmbed] });
        }
      } catch (error) {
        console.log(error);
        msg.reply("This Spell Is Not A Thing");
      }
}
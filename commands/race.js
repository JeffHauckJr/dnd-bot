const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const race = msg.content
          .split(" ")
          .slice(2)
          .join(" ")
          .toLocaleLowerCase();
        const raceUrl = `https://www.dnd5eapi.co/api/races/${race}`;
        const response = await axios.get(raceUrl);
        const data = response.data;
        const racialTraits = data.traits
          .map((trait) => {
            return `${trait.name}
          `;
          })
          .join(" ");
  
        const subraces = data.subraces
          .map((sub) => {
            return `${sub.name}`;
          })
          .join(" ");
  
        const abilityBonuses = data.ability_bonuses
          .map((abl) => {
            return `+${abl.bonus} bonus to ${abl.ability_score.name}`;
          })
          .join(" ");
  
        const raceEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`Race : ${data.name}`)
          .setURL()
          .addFields(
            { name: "Ability Bonuses", value: `${abilityBonuses}` || `No Data` },
            {
              name: `Racial Speed`,
              value: `${data.speed}` || "No Data",
            },
            {
              name: "Common Alignment",
              value: `${data.alignment}` || "No Data",
            },
            {
              name: "Size",
              value: `${data.size_description}` || "No Data",
            },
            {
              name: "Racial Traits",
              value: `${racialTraits}` || "No Data",
            },
            {
              name: "Language",
              value: `${data.language_desc}` || "No Data",
            },
            {
              name: "Sub Races",
              value: `${subraces}` || "No Data",
            }
          );
  
        msg.reply({ embeds: [raceEmbed] });
      } catch (err) {
        console.log(err);
        msg.reply("No information on that race.");
      }
}
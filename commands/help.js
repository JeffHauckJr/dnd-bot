const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    const commandEmbed = new MessageEmbed()
      .setColor("#F50B0B")
      .setTitle(
        `
      Hello Weary Traveler, Below are the current knowledge checks I can assist you with.
      `
      )
      .addFields(
        { name: "Race", value: `~ race [race name]` },
        { name: "Class", value: `~ class [class name]` },
        { name: "Spell", value: `~ spell [spell name]` },
        { name: "Equipment", value: `~ equipment [equipment name]` },
        { name: "Monster", value: `~ spell [monster name]` },
        { name: "Class Features", value: `~ classfeat [feat name]` },
        {
          name: "Rules",
          value: `~ rules *list of all rules* ~ rules [specific rule]`,
        },
        {
          name: "School of Magic",
          value: `~ magic *all achools*   ||  ~ magic [school name] *specific school*`,
        },
        { name: "Dice Roll", value: `~ roll [number of dice 1-9][die 1-100]` },
        {
          name: "Careful! There are magic rituals under way.",
          value: `Stay tuned Adventurers!`,
        },
        {
          name: "Author",
          value: `
          Discord: <@122818058703208450>
          Github: https://github.com/JeffHauckJr 
          `,
        }
      );

    msg.channel.send({ embeds: [commandEmbed] });
}
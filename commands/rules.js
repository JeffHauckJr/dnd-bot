const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const rules = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = rules.split(" ");
  
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
            return rules;
          }
        };
  
        const rulesUrl =
          `https://www.dnd5eapi.co/api/rules/${newInput()}` &&
          `https://www.dnd5eapi.co/api/rule-sections/${newInput()}`;
        const response = await axios.get(rulesUrl);
        if (rules) {
          const description = response.data.desc
            .split(" ")
            .join(" ")
            .substring(0, 3000);
          const description2 = response.data.desc
            .split(" ")
            .join(" ")
            .substring(3001, 6000);
          const description3 = response.data.desc
            .split(" ")
            .join(" ")
            .substring(6001, 9000);
          const description4 = response.data.desc
            .split(" ")
            .join(" ")
            .substring(9001, 12000);
          const description5 = response.data.desc
            .split(" ")
            .join(" ")
            .substring(12001, 15000);
  
          if (description) {
            const rulesEmbed = new MessageEmbed()
              .setColor(`RED`)
              .setTitle(`${response.data.name}`)
              .setDescription(`${description}`);
  
            msg.reply({ embeds: [rulesEmbed] });
          }
          if (description2) {
            const rulesEmbed = new MessageEmbed()
              .setColor(`RED`)
              .setTitle(`${response.data.name}`)
              .setDescription(`-${description2}`);
  
            msg.reply({ embeds: [rulesEmbed] });
          } else {
            return;
          }
  
          if (description3) {
            const rulesEmbed = new MessageEmbed()
              .setColor(`RED`)
              .setTitle(`${response.data.name}`)
              .setDescription(`-${description3}`);
  
            msg.reply({ embeds: [rulesEmbed] });
          } else {
            return;
          }
  
          if (description4) {
            const rulesEmbed = new MessageEmbed()
              .setColor(`RED`)
              .setTitle(`${response.data.name}`)
              .setDescription(`-${description4}`);
  
            msg.reply({ embeds: [rulesEmbed] });
          } else {
            return;
          }
  
          if (description5) {
            const rulesEmbed = new MessageEmbed()
              .setColor(`RED`)
              .setTitle(`${response.data.name}`)
              .setDescription(`-${description5}`);
  
            msg.reply({ embeds: [rulesEmbed] });
          } else {
            return;
          }
        } else {
          const rulesEmbed = new MessageEmbed()
            .setColor(`RED`)
            .setTitle(`Rules`)
            .setDescription(
              `${response.data.results
                .map((rule) => {
                  return `
                  ${rule.name}`;
                })
                .join(" ")}`
            );
  
          msg.reply({ embeds: [rulesEmbed] });
        }
      } catch (err) {
        console.log(err);
        msg.reply("There is no Data on that Rule");
      }
}
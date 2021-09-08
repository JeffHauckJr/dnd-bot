const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const alignment = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = alignment.split(" ");
  
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
            return alignment;
          }
        };
        const alignURL = `https://www.dnd5eapi.co/api/alignments/${newInput()}`;
        const response = await axios.get(alignURL);
  
        const alignEmbed = new MessageEmbed()
          .setColor(`#F50B0B`)
          .setTitle(`${response.data.name}`)
          .setFields({
            name: `Description`,
            value: `${response.data.desc}`,
          });
        msg.reply({ embeds: [alignEmbed] });
      } catch (err) {
        console.log(err);
      }
}
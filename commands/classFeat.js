const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const feat = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = feat.split(" ");
  
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
            return feat;
          }
        };
        const featUrl = `https://www.dnd5eapi.co/api/features/${newInput()}`;
        const response = await axios.get(featUrl);
        const data = response.data;
  
        const featClass = data.class.name;
  
        const featEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`Class Features : ${data.name}`)
          .addFields(
            {
              name: "Class",
              value: `${featClass}`,
            },
            {
              name: `Level`,
              value: `${data.level}` || "No Data",
            },
            {
              name: "Description",
              value: `${data.desc}` || "No Data",
            },
            {
              name: "Prerequisites",
              value: `${data.prerequisites}` || "No Data",
            }
          );
  
        msg.reply({ embeds: [featEmbed] });
      } catch (err) {
        console.log(err);
        msg.reply("No feats match that");
      }
}

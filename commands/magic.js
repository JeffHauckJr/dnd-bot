const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const magic = msg.content.split(" ").slice(2).join(" ").toLowerCase();
    
        const magURL = `https://www.dnd5eapi.co/api/magic-schools/${magic}`;
        const response = await axios.get(magURL);
        console.log(response.data);
    
        if (magic) {
          const magicEmbed = new MessageEmbed()
            .setColor(`RED`)
            .setTitle(`${response.data.name}`)
            .setDescription(`${response.data.desc}`);
    
          msg.reply({ embeds: [magicEmbed] });
        } else {
          const magicEmbed = new MessageEmbed()
            .setColor(`RED`)
            .setTitle(`Schools of Magic`)
            .setFields({
              name: `Schools`,
              value: `${response.data.results
                .map((mag) => {
                  return `
            ${mag.name}
            `;
                })
                .join(" ")}`,
            });
    
          msg.reply({ embeds: [magicEmbed] });
        }
      } catch (err) {
        console.log(err);
      }
}




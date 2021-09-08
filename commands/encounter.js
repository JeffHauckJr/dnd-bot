const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const monURL = `https://www.dnd5eapi.co/api/monsters/`;
        const response = await axios.get(monURL);
        const data = response.data;
  
        const randomMonster =
          data.results[Math.floor(Math.random() * data.results.length)].name;
  
        console.log(randomMonster, "!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  
        const randMonEmbed = new MessageEmbed()
          .setColor(`RED`)
          .setTitle(
            `Your Party has Encountered a/n ${randomMonster}. Roll for initiative.`
          );
  
        msg.reply({ embeds: [randMonEmbed] });
      } catch (err) {
        console.log(err);
      }
}
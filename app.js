require("dotenv").config();
const { Client, Intents, MessageEmbed } = require("discord.js");
const axios = require("axios");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
  ],
});
const TOKEN = process.env.TOKEN;

client.on("ready", () => {
  console.info(`Logged in as ${client.user.tag}!`);
});

const prefix = "~";

client.on("messageCreate", async (msg) => {
  const args = msg.content.slice(prefix.length).trim().split(" ");

  const command = args.shift().toLowerCase();

  if (command === "spell") {
    try {
      const spell = msg.content.split(" ").slice(2).join(" ");
      const spellUrl = `https://www.dnd5eapi.co/api/spells/${spell}/`;
      const response = await axios.get(spellUrl);
      const data = response.data;
        console.log(data)
        const damageSpell = `3: ${data.damage.damage_at_slot_level[3]}
        4: ${data.damage.damage_at_slot_level[4]}
      5: ${data.damage.damage_at_slot_level[5]}
      6: ${data.damage.damage_at_slot_level[6]}
      7: ${data.damage.damage_at_slot_level[7]}
      8: ${data.damage.damage_at_slot_level[8]}
      9: ${data.damage.damage_at_slot_level[9]}` 


      const damageSpellEmbed = new MessageEmbed()
        .setColor("#ff9538")
        .setTitle(`${data.name}`)
        .setURL()
        .addFields(
          { name: "Description", value: `${data.desc}` },
          { name: "Range", value: `${data.range}` },
          { name: "Components", value: `${data.components}` },
          { name: "Materials", value: `${data.material}` },
          { name: "Duration", value: `${data.duration}` },
          { name: "Level", value: `${data.level}` },
          
        );

        const supportSpellEmbed = new MessageEmbed()
        .setColor("#ff9538")
        .setTitle(`${data.name}`)
        .setURL()
        .addFields(
          { name: "Description", value: `${data.desc}` },
          { name: "Range", value: `${data.range}` },
          { name: "Components", value: `${data.components}` },
          { name: "Materials", value: `${data.material}` },
          { name: "Duration", value: `${data.duration}` },
          { name: "Level", value: `${data.level}` },
        );

      msg.reply({ embeds: [damageSpellEmbed || supportSpellEmbed] });
    } catch (error) {
      console.log(error);
      msg.reply("This Spell Is Not A Thing");
    }
  }
});

client.login(TOKEN);

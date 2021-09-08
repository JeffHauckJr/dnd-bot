require("dotenv").config();
const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");
const commandPrompt = require("./commands")
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



client.on("messageCreate", commandPrompt) 

client.login(TOKEN);

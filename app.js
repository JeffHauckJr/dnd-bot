require("dotenv").config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require("axios");
const commandPrompt = require("./commands")
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.TOKEN;

client.on("ready", () => {
  console.info(`Logged in as ${client.user.tag}!`);
});



client.on("messageCreate", commandPrompt) 

client.login(TOKEN);

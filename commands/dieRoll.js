const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    const dice = msg.content.split(" ").slice(2).join(" ").toLowerCase();

    //Grad the string that is after the "roll"

    const numOfDie = dice.slice(0, 1);
    const dieNumber = dice.substring(2);
    console.log(dieNumber);
    console.log(numOfDie);

    function rollDice(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1)) * numOfDie;
    }

    const diceRoll = () => {
      return `${rollDice(1, dieNumber)} `;
    };

    msg.reply(diceRoll());
}






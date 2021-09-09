const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");

module.exports = async (msg) => {
    try {
        const equipment = msg.content.split(" ").slice(2).join(" ").toLowerCase();
  
        const indWords = equipment.split(" ");
  
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
            return equipment;
          }
        };
  
        const equipURL = `https://www.dnd5eapi.co/api/equipment/${newInput()}`;
        const response = await axios.get(equipURL);
        const data = response.data;
        console.log(data);
  
        if (data.armor_category) {
          const armorEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .addFields(
              {
                name: `Equipment Category`,
                value: `${data.equipment_category.name}`,
              },
              {
                name: `Armor Category`,
                value: `${data.armor_category}`,
              },
              {
                name: `Armor Class`,
                value: `${data.armor_class.base}`,
              },
              {
                name: `Strength Minimum`,
                value: `${data.str_minimum}`,
              },
              {
                name: `Cost`,
                value: `${data.cost.quantity} ${data.cost.unit}`,
              }
            );
          msg.reply({ embeds: [armorEmbed] });
        } else if (data.damage) {

          
          const weapondEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .addFields(
              {
                name: `Equipment Category`,
                value: `${data.equipment_category.name}`,
              },
              {
                name: `Weapon Category`,
                value: `${data.weapon_category}`,
              },
              {
                name: `Weapon Range`,
                value: ` Normal: ${data.range.normal}
                Long: ${data.range.long ? null : "N/A"}`,
              },
              {
                name: `Damage`,
                value: `
                Dice: ${data.damage.damage_dice}
                Type: ${data.damage.damage_type.name}
                `,
              },
              {
                name: `Properties`,
                value: `${data.properties
                  .map((prop) => {
                    return `
                   ${prop.name.replace(",", "")}
                   `;
                  })
                  .join(" ")}`,
              },
              {
                name: `Cost`,
                value: `${data.cost.quantity} ${data.cost.unit}`,
              }
            );
          msg.reply({ embeds: [weapondEmbed] });
        } else {
          const equipmentEmbed = new MessageEmbed()
            .setColor("#F50B0B")
            .setTitle(`${data.name}`)
            .addFields(
              { name: `Description`, value: `${data.desc || "No Description"}` },
              { name: `Cost`, value: `${data.cost.quantity} ${data.cost.unit}` }
            );
  
          msg.reply({ embeds: [equipmentEmbed] });
        }
      } catch (err) {
        console.log(err);
        msg.reply("There is no Data on that item");
      }
}
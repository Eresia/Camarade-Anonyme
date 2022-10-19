const DiscordUtils = require('../scripts/discord-utils.js');
const { EmbedBuilder } = require('discord.js');

const minTimeBeetweenMessage = 1000 * 60 * 1;

let messageData = {};

function createQuestionEmbed(messageContent)
{
    let embed = new EmbedBuilder();
    embed.setTitle('Nouvelle question anonyme');
    embed.setDescription(messageContent);
    return embed;
}

async function askQuestion(dataManager, guild, userId, messageContent)
{
    let guildData = dataManager.getServerData(guild.id);

    if(guildData.bannedUsers.includes(userId))
    {
        return 'Vous avez été bannis des services de questions anonymes. Si vous pensez que c\'est une erreur, merci de contacter l\'administrateur·ice de votre serveur.';
    }

    if(messageContent.length > 2000)
    {
        return 'Votre message est trop long, je ne peux l\'envoyer tel quel, j\'en suis désolé.';
    }

    if(!(guild.id in messageData))
    {
        messageData[guild.id] = {};
    }

    if(!(userId in messageData[guild.id]))
    {
        messageData[guild.id][userId] = [];
    }

    let actualDate = Date.now();

    if(messageData[guild.id][userId].length != 0)
    {
        let diff = actualDate - messageData[guild.id][userId][messageData[guild.id][userId].length - 1].date;
        if(diff < minTimeBeetweenMessage)
        {
            return 'Vous devez attendre encore ' + Math.ceil((minTimeBeetweenMessage - diff) / 1000) + ' secondes avant de pouvoir reposer une question anonyme.';
        }
    }

    let channel = await DiscordUtils.getChannelById(guild.client, guildData.anonymousQuestionChannel);

    if(channel == null)
    {
        dataManager.logError(guild, 'Error: No anonymous question channel exist');
        return 'Le channel de question anonyme n\'est pas correctement paramétré. Un message anonyme a été envoyé à votre administrateur pour le prévenir.';
    }

    if(messageData[guild.id][userId].length >= 4)
    {
        messageData[guild.id][userId].shift();
    }

	let message = await channel.send({embeds: [createQuestionEmbed(messageContent)]});

    messageData[guild.id][userId].push({'messageId': message.id, date: actualDate});
    return 'Message envoyé anonymement !';
}

function getAuthor(dataManager, guild, messageId)
{
    if(!(guild.id in messageData))
    {
        return null;
    }

    for(let userId in messageData[guild.id])
    {
        for(let i = 0; i < messageData[guild.id][userId].length; i++)
        {
            if(messageData[guild.id][userId][i].messageId == messageId)
            {
                return userId;
            }
        }
    }

    return null;
}

module.exports = 
{
	askQuestion,
    getAuthor
}
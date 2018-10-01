// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes, MessageFactory, CardFactory } = require('botbuilder');
const { DialogSet, ChoicePrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const { SlotFillingDialog } = require('./SlotFillingDialog');
const { SlotDetails } = require('./SlotDetails');
const ImageGalleryCard = require('./resources/ImageGalleryCard.json');

const DIALOG_STATE_PROPERTY = 'dialogState';
class SampleBot {
    /**
     * MainDialog defines the core business logic of this bot.
     * @param {ConversationState} conversationState A ConversationState object used to store dialog state.
     */
    constructor(conversationState) {
        this.conversationState = conversationState;

        // Create a property used to store dialog state.
        // See https://aka.ms/about-bot-state-accessors to learn more about bot state and state accessors.
        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);

        // Create a dialog set to include the dialogs used by this bot.
        this.dialogs = new DialogSet(this.dialogState);

        // Add the individual child dialogs and prompts used.
        // Note that the built-in prompts work hand-in-hand with our custom SlotFillingDialog class
        // because they are both based on the provided Dialog class.
        this.dialogs.add(new ChoicePrompt('level1'));
        this.dialogs.add(new ChoicePrompt('level2'));

        // Finally, add a 2-step WaterfallDialog that will initiate the SlotFillingDialog,
        // and then collect and display the results.
        this.dialogs.add(new WaterfallDialog('root', [
            this.promptForL1.bind(this),
            this.promptForL2.bind(this),
            this.processResults.bind(this)
        ]));
    }

    /**
     * Send suggested actions to the user.
     * @param {TurnContext} turnContext A TurnContext instance containing all the data needed for processing this conversation turn.
     */
    async getSuggestedActions(options, message) {
        return MessageFactory.suggestedActions(options, message);
    }

    async promptForL1(step) {
        await step.prompt('level1', 'Veuillez choisir une catégories ci-dessous', ['Assistance', 'Déclaration', 'Réparation', 'Autres']);
    }

    async promptForL2(step) {
        switch (step.result.value) {
        case 'Déclaration':
            console.log('declaration');
            break;
        case 'Assistance':
            console.log('Assistance');
            return await step.prompt('level2', `Sub domain`, ['AssistanceOutsideBE_FR', 'AssistanceUnhappy_FR', 'Book_Depanneur_FR', 'DépanneurFriendliness_FR', 'DépanneurLocation_FR', 'FlatTire_FR', 'HeurtAuto_FR', 'HeurtAutoAnimal_FR', 'ProblemCar_FR']);
        case 'Réparation':
            console.log('Réparation');
            break;
        case 'Autres':
            console.log('Autres');
            break;
        default:
            console.log('default');
            return await step.prompt('level2', `Sub domain`);
        }
    }

    // This is the second step of the WaterfallDialog.
    // It receives the results of the SlotFillingDialog and displays them.
    async processResults(step) {
        // Each "slot" in the SlotFillingDialog is represented by a field in step.result.values.
        // The complex that contain subfields have their own .values field containing the sub-values.
        const values = step.result.values;

        const fullname = values['fullname'].values;
        await step.context.sendActivity(`Your name is ${ fullname['first'] } ${ fullname['last'] }.`);

        await step.context.sendActivity(`You wear a size ${ values['shoesize'] } shoe.`);

        const address = values['address'].values;
        await step.context.sendActivity(`Your address is: ${ address['street'] }, ${ address['city'] } ${ address['zip'] }`);

        return await step.endDialog();
    }

    // Validate that the provided shoe size is between 0 and 16, and allow half steps.
    // This is used to instantiate a specialized NumberPrompt.
    async shoeSizeValidator(prompt) {
        if (prompt.recognized.succeeded) {
            const shoesize = prompt.recognized.value;

            // Shoe sizes can range from 0 to 16.
            if (shoesize >= 0 && shoesize <= 16) {
                // We only accept round numbers or half sizes.
                if (Math.floor(shoesize) === shoesize || Math.floor(shoesize * 2) === shoesize * 2) {
                    // Indicate success.
                    return true;
                }
            }
        }

        return false;
    }

    /**
     *
     * @param {TurnContext} turnContext A TurnContext object representing an incoming message to be handled by the bot.
     */
    async onTurn(turnContext) {
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        const dc = await this.dialogs.createContext(turnContext);
        if (turnContext.activity.type === ActivityTypes.Message) {
            // Create dialog context.

            const utterance = (turnContext.activity.text || '').trim().toLowerCase();
            if (utterance === 'cancel') {
                if (dc.activeDialog) {
                    await dc.cancelAllDialogs();
                    await dc.context.sendActivity(`Ok... canceled.`);
                } else {
                    await dc.context.sendActivity(`Nothing to cancel.`);
                }
            }

            if (!dc.context.responded) {
                // Continue the current dialog if one is pending.
                await dc.continueDialog();
            }

            if (!dc.context.responded) {
                // If no response has been sent, start the onboarding dialog.
                await dc.beginDialog('root');
            }
        } else if (
            turnContext.activity.type === ActivityTypes.ConversationUpdate &&
             turnContext.activity.membersAdded[0].name !== 'Bot'
        ) {
            // Send a "this is what the bot does" message.
            await this.sendWelcomeMessage(turnContext);
            await dc.beginDialog('root');
            // await turnContext.sendActivity(description.join(' '));
        }

        await this.conversationState.saveChanges(turnContext);
    }

    /**
     * Sends welcome messages to conversation members when they join the conversation.
     * Messages are only sent to conversation members who aren't the bot.
     * @param {TurnContext} turnContext
     */

    async sendWelcomeMessage(turnContext) {
        // await turnContext.sendActivity({ attachments: [this.createAnimationCard()] });
        // await turnContext.sendActivity({ attachments: [this.createThumbnailCard()] });
        await turnContext.sendActivity(`Bonjour, comment puis-je vous aider ? `);
        // await turnContext.sendActivity({
        //     attachmentLayout: 'carousel',
        //     attachments: [this.createHeroCard(), this.createHeroCard()] 
        // });
        // await turnContext.sendActivity({
        //     text: 'Here is an Adaptive Card:',
        //     attachments: [CardFactory.adaptiveCard(ImageGalleryCard)]
        // });
    }

    createAnimationCard() {
        return CardFactory.animationCard(
            'Microsoft Bot Framework',
            [
                { url: 'https://i.giphy.com/Ki55RUbOV5njy.gif' }
            ],
            [],
            {
                subtitle: 'Animation Card'
            }
        );
    }

    createThumbnailCard() {
        return CardFactory.thumbnailCard(
            'BotFramework Thumbnail Card',
            [{ url: 'https://sec.ch9.ms/ch9/7ff5/e07cfef0-aa3b-40bb-9baa-7c9ef8ff7ff5/buildreactionbotframework_960.jpg' }],
            [{
                type: 'openUrl',
                title: 'Get started',
                value: 'https://docs.microsoft.com/en-us/azure/bot-service/'
            }],
            {
                subtitle: 'Your bots — wherever your users are talking.',
                text: 'Build and connect intelligent bots to interact with your users naturally wherever they are, from text/sms to Skype, Slack, Office 365 mail and other popular services.'
            }
        );
    }
    
    createHeroCard() {
        return CardFactory.heroCard(
            'BotFramework Hero Card',
            CardFactory.images(['https://sec.ch9.ms/ch9/7ff5/e07cfef0-aa3b-40bb-9baa-7c9ef8ff7ff5/buildreactionbotframework_960.jpg']),
            CardFactory.actions([
                {
                    type: 'openUrl',
                    title: 'Get started',
                    value: 'https://docs.microsoft.com/en-us/azure/bot-service/'
                }
            ])
        );
    }

    /**
     * Create the choices with synonyms to render for the user during the ChoicePrompt.
     */
    getChoices() {
        const cardOptions = [
            {
                value: 'Animation Card',
                synonyms: ['1', 'animation', 'animation card']
            },
            {
                value: 'Audio Card',
                synonyms: ['2', 'audio', 'audio card']
            },
            {
                value: 'Hero Card',
                synonyms: ['3', 'hero', 'hero card']
            },
            {
                value: 'Receipt Card',
                synonyms: ['4', 'receipt', 'receipt card']
            },
            {
                value: 'Signin Card',
                synonyms: ['5', 'signin', 'signin card']
            },
            {
                value: 'Thumbnail Card',
                synonyms: ['6', 'thumbnail', 'thumbnail card']
            },
            {
                value: 'Video Card',
                synonyms: ['7', 'video', 'video card']
            },
            {
                value: 'All Cards',
                synonyms: ['8', 'all', 'all cards']
            }
        ];

        return cardOptions;
    }
}

module.exports.SampleBot = SampleBot;

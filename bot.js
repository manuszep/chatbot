// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes, MessageFactory } = require('botbuilder');
const { DialogSet, ChoicePrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const { SlotFillingDialog } = require('./SlotFillingDialog');
const { SlotDetails } = require('./SlotDetails');

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

        const l1Slot = new SlotDetails('level1', 'level1', this.getSuggestedActions([
            'Assistance',
            'Déclaration',
            'Réparation',
            'Autres'
        ], 'Domaine'));
        const l2Slot = new SlotDetails('level2', 'level2', 'Subdomain');

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
        await step.prompt('level1', 'Domain', ['Assistance', 'Déclaration', 'Réparation', 'Autres']);
    }

    async promptForL2(step) {
        return await step.prompt('level2', `Sub domain`);
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
        if (turnContext.activity.type === ActivityTypes.Message) {
            // Create dialog context.
            const dc = await this.dialogs.createContext(turnContext);

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
            const description = [
                'This is a bot that demonstrates an alternate dialog system',
                'which uses a slot filling technique to collect multiple responses from a user.',
                'Say anything to continue.'
            ];
            await turnContext.sendActivity(description.join(' '));
        }

        await this.conversationState.saveChanges(turnContext);
    }
}

module.exports.SampleBot = SampleBot;

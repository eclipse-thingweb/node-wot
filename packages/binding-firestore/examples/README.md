# How to start examples for binding-firebase

1. intall node modules
   `npm install`
1. start firebase emulator
   example is executed using the firebase emulator.
   `$ npm start fbemu`
1. start counter-thing
   Start the counter-thing example.
   `$ npm start example:counter-thing`
1. start counter-client
   Start counter-client and access counter-thing.
   `$ npm start example:counter-client`

If you would like to run the program in Firebase instead of in the Firebase emulator, please do the following.

-   Modify the contents of `firestore-config.json` to match your Firebase configuration.
-   Delete the `initFirebaseEmu()` method running in `counter-thing.js` and `counter-client.js`

# oAuth example
The example is composed by two actors: one Thing that expose an action with oAuth2.0 client credential security constraint and a client who want to use that function. In the example, we are using an utility server to generate tokens and validate client credentials. Therefore, the **wot-consumer** force the action `href` to be the same as the utility server with the goal to validate the obtained oAuth2.0 token. In the feature the exposing servient could also play this role. 

## run the example

```bash
npm install
npm run build
```
After this follow the procedure described in [here](../../README.md) and remove the unwanted line of codes inside the scripts `./dist/consumer.js` and `./dist/exposer.js`.

Now you are ready to run the example.

```bash
# start the server
npm run server
```
in a different terminal 

```bash
# start the exposer
npm run start:exposer
```
Finally, in other terminal
```bash
npm run start:consumer
```

you should see the following line at the end of consumer log:
```bash
oAuth token was Ok!
```
This confirm that the oAuth flow was completed successfully.

## Where is a JS version
See [here](../../../examples/security/oauth)
